import json
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.language_models import BaseChatModel

from app.schemas import IssueDocument, WikiDocument
from app.prompts.task_prompts import SYSTEM_PROMPT_TEMPLATE
from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_llm(model_key: str = "rag") -> BaseChatModel:
    settings = get_settings()

    if settings.use_groq and settings.groq_api_key:
        try:
            from langchain_groq import ChatGroq
            model = settings.groq_model_rag if model_key == "rag" else settings.groq_model_chat
            logger.info(f"Using Groq LLM: {model}")
            return ChatGroq(
                model=model,
                temperature=0 if model_key == "rag" else 0.7,
                groq_api_key=settings.groq_api_key,
            )
        except ImportError:
            logger.warning("langchain-groq not installed. Falling back to OpenAI.")

    model = settings.openai_model_rag if model_key == "rag" else settings.openai_model_chat
    max_tokens = settings.openai_max_tokens_rag if model_key == "rag" else settings.openai_max_tokens_chat
    logger.info(f"Using OpenAI LLM: {model}")
    return ChatOpenAI(
        model=model,
        temperature=0 if model_key == "rag" else 0.7,
        max_tokens=max_tokens,
        openai_api_key=settings.openai_api_key,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def get_vector_store() -> Chroma:
    settings = get_settings()
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.openai_api_key,
    )
    return Chroma(
        collection_name=settings.chroma_collection,
        embedding_function=embeddings,
        persist_directory=settings.chroma_db_dir,
    )


def _clear_collection(vector_store: Chroma) -> int:
    """Deletes all documents from the collection. Returns count deleted."""
    existing_ids = vector_store._collection.get()["ids"]
    if existing_ids:
        vector_store._collection.delete(ids=existing_ids)
    return len(existing_ids)


def _issue_to_document(issue: IssueDocument) -> Document:
    labels_str = ", ".join(issue.labels) if issue.labels else "none"
    pts_str = str(issue.story_points) if issue.story_points else "unestimated"
    return Document(
        page_content=(
            f"[ISSUE] Project: {issue.project}\n"
            f"Title: {issue.title}\n"
            f"Labels: {labels_str}\n"
            f"Type: {issue.issue_type} | Priority: {issue.priority} | Status: {issue.status}\n"
            f"Story Points: {pts_str}\n"
            f"Assignee: {issue.assignee}\n"
            f"Description: {issue.description[:400]}"
        ),
        metadata={
            "doc_type": "issue",
            "issue_id": issue.issue_id,
            "project": issue.project,
            "labels": labels_str,
            "assignee": issue.assignee,
            "story_points": pts_str,
            "issue_type": issue.issue_type,
            "priority": issue.priority,
        },
    )


def _wiki_to_document(wiki: WikiDocument) -> Document:
    breadcrumb = f"{wiki.space} > {wiki.parent_title} > {wiki.title}" if wiki.parent_title else f"{wiki.space} > {wiki.title}"
    return Document(
        page_content=(
            f"[WIKI] Project: {wiki.project}\n"
            f"Path: {breadcrumb}\n"
            f"Title: {wiki.title}\n"
            f"Author: {wiki.created_by or 'Unknown'}\n"
            f"Content: {wiki.content[:600]}"
        ),
        metadata={
            "doc_type": "wiki",
            "wiki_id": wiki.wiki_id,
            "project": wiki.project,
            "space": wiki.space or "",
            "title": wiki.title,
            "created_by": wiki.created_by or "",
        },
    )


def full_sync(issues: list[IssueDocument], wiki_pages: list[WikiDocument]) -> dict:
    """
    Full resync:
    1. Clears ALL existing ChromaDB documents
    2. Re-embeds all issues + wiki pages from Postgres

    Called by POST /ai/sync from the Django BE.
    """
    vector_store = get_vector_store()

    deleted = _clear_collection(vector_store)
    logger.info(f"Cleared {deleted} documents from ChromaDB before resync")

    docs = []
    for issue in issues:
        docs.append(_issue_to_document(issue))
    for wiki in wiki_pages:
        docs.append(_wiki_to_document(wiki))

    # Embed in batches of 50 to avoid memory/timeout issues
    batch_size = 50
    for i in range(0, len(docs), batch_size):
        vector_store.add_documents(docs[i:i + batch_size])

    issues_count = len(issues)
    wiki_count = len(wiki_pages)
    logger.info(f"Full sync complete: {issues_count} issues + {wiki_count} wiki pages = {len(docs)} total documents")

    return {
        "deleted_before_sync": deleted,
        "issues_synced": issues_count,
        "wiki_pages_synced": wiki_count,
        "total_documents": len(docs),
    }


def get_sync_status() -> dict:
    """Returns current ChromaDB document counts by type."""
    vector_store = get_vector_store()
    all_docs = vector_store._collection.get(include=["metadatas"])
    metadatas = all_docs.get("metadatas", [])

    issue_count = sum(1 for m in metadatas if m.get("doc_type") == "issue")
    wiki_count = sum(1 for m in metadatas if m.get("doc_type") == "wiki")
    total = len(metadatas)

    return {
        "total_documents": total,
        "issues": issue_count,
        "wiki_pages": wiki_count,
        "other": total - issue_count - wiki_count,
    }


def analyze_task_with_rag(heading: str, description: str, labels: list[str]) -> dict:
    """
    Label-aware RAG analysis:
    - Retrieves past issues with matching labels from ChromaDB
    - Estimates story points
    - Recommends assignee based on who handled similar labeled issues
    """
    settings = get_settings()
    vector_store = get_vector_store()

    labels_str = ", ".join(labels) if labels else "general"
    # Query emphasises labels so retrieval is label-aware, then falls back to title similarity
    query = f"Labels: {labels_str}. Issue: {heading}. {description[:200]}"

    # Filter to only issue documents (not wiki)
    retrieved_docs = vector_store.similarity_search(
        query,
        k=settings.chroma_retrieval_k,
        filter={"doc_type": "issue"},
    )
    issue_history = "\n\n---\n".join([doc.page_content for doc in retrieved_docs])

    logger.info(f"RAG: retrieved {len(retrieved_docs)} past issues | labels={labels_str}")

    llm = get_llm(model_key="rag")
    prompt = PromptTemplate(
        template=SYSTEM_PROMPT_TEMPLATE,
        input_variables=["issue_history", "heading", "labels", "description"],
    )

    chain = prompt | llm
    response_msg = chain.invoke({
        "issue_history": issue_history,
        "heading": heading,
        "labels": labels_str,
        "description": description,
    })

    return json.loads(response_msg.content)

import json
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.language_models import BaseChatModel

from app.schemas import IssueDocument, WikiDocument, UserDocument, ProjectDocument, SprintDocument
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


def _user_to_document(user: UserDocument) -> Document:
    projects_str = ", ".join(user.projects) if user.projects else "none"
    return Document(
        page_content=(
            f"[USER] Name: {user.name}\n"
            f"Email: {user.email}\n"
            f"Role: {user.role}\n"
            f"Projects: {projects_str}"
        ),
        metadata={
            "doc_type": "user",
            "user_id": user.user_id,
            "name": user.name,
            "role": user.role,
            "email": user.email,
        },
    )


def _project_to_document(project: ProjectDocument) -> Document:
    members_str = ", ".join(project.members) if project.members else "none"
    archived_str = "Yes" if project.is_archived else "No"
    return Document(
        page_content=(
            f"[PROJECT] Name: {project.name}\n"
            f"Owner: {project.owner}\n"
            f"Members: {members_str}\n"
            f"Archived: {archived_str}\n"
            f"Description: {project.description[:400]}"
        ),
        metadata={
            "doc_type": "project",
            "project_id": project.project_id,
            "name": project.name,
            "owner": project.owner,
            "is_archived": str(project.is_archived),
        },
    )


def _sprint_to_document(sprint: SprintDocument) -> Document:
    dates = ""
    if sprint.start_date and sprint.end_date:
        dates = f"{sprint.start_date} → {sprint.end_date}"
    elif sprint.start_date:
        dates = f"Started {sprint.start_date}"
    return Document(
        page_content=(
            f"[SPRINT] Name: {sprint.name}\n"
            f"Project: {sprint.project}\n"
            f"Status: {sprint.status}\n"
            f"Dates: {dates or 'Not set'}\n"
            f"Issues: {sprint.done_issues} done / {sprint.total_issues} total"
        ),
        metadata={
            "doc_type": "sprint",
            "sprint_id": sprint.sprint_id,
            "project": sprint.project,
            "status": sprint.status,
        },
    )


def full_sync(
    issues: list[IssueDocument],
    wiki_pages: list[WikiDocument],
    users: list[UserDocument] | None = None,
    projects: list[ProjectDocument] | None = None,
    sprints: list[SprintDocument] | None = None,
) -> dict:
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
    for user in (users or []):
        docs.append(_user_to_document(user))
    for project in (projects or []):
        docs.append(_project_to_document(project))
    for sprint in (sprints or []):
        docs.append(_sprint_to_document(sprint))

    batch_size = 50
    for i in range(0, len(docs), batch_size):
        vector_store.add_documents(docs[i:i + batch_size])

    counts = {
        "issues": len(issues),
        "wiki_pages": len(wiki_pages),
        "users": len(users or []),
        "projects": len(projects or []),
        "sprints": len(sprints or []),
        "total_documents": len(docs),
        "deleted_before_sync": deleted,
    }
    logger.info(f"Full sync complete: {counts}")
    return counts


def get_sync_status() -> dict:
    """Returns current ChromaDB document counts by type."""
    vector_store = get_vector_store()
    all_docs = vector_store._collection.get(include=["metadatas"])
    metadatas = all_docs.get("metadatas", [])

    counts: dict[str, int] = {}
    for m in metadatas:
        doc_type = m.get("doc_type", "other")
        counts[doc_type] = counts.get(doc_type, 0) + 1

    total = len(metadatas)
    return {
        "total_documents": total,
        "issues":   counts.get("issue", 0),
        "wiki_pages": counts.get("wiki", 0),
        "users":    counts.get("user", 0),
        "projects": counts.get("project", 0),
        "sprints":  counts.get("sprint", 0),
    }


def semantic_search(query: str, k: int = 10) -> list[dict]:
    """Semantic similarity search across issues and wiki pages stored in ChromaDB."""
    vector_store = get_vector_store()
    docs = vector_store.similarity_search(query, k=k)

    results = []
    for doc in docs:
        meta = doc.metadata
        doc_type = meta.get("doc_type", "issue")

        title = ""
        for line in doc.page_content.split("\n"):
            if line.startswith("Title: "):
                title = line[7:].strip()
                break

        excerpt = ""
        for prefix in ("Description: ", "Content: "):
            for line in doc.page_content.split("\n"):
                if line.startswith(prefix):
                    excerpt = line[len(prefix):].strip()[:200]
                    break
            if excerpt:
                break

        if doc_type == "issue":
            results.append({
                "id": meta.get("issue_id", ""),
                "type": "issue",
                "title": title,
                "excerpt": excerpt,
            })
        elif doc_type == "wiki":
            results.append({
                "id": meta.get("wiki_id", ""),
                "type": "wiki",
                "title": title or meta.get("title", ""),
                "excerpt": excerpt,
            })

    return results


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

import json
from langchain_core.prompts import PromptTemplate

from app.prompts.task_prompts import CHATBOT_PROMPT_TEMPLATE
from app.services.rag_pipeline import get_llm, get_vector_store
from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def chat_with_rag(
    message: str,
    project_name: str | None = None,
    workspace_context: str | None = None,
) -> dict:
    """
    RAG-powered read-only chatbot.

    1. Semantic search ChromaDB for relevant issues + wiki pages.
    2. Optionally scopes results to a specific project.
    3. Injects retrieved context + live workspace stats into the prompt.
    4. LLM answers only from context; rejects out-of-scope questions.
    """
    settings = get_settings()
    vector_store = get_vector_store()

    # Build search query — include project name hint if available
    search_query = f"{message} {project_name}" if project_name else message

    # Retrieve top-k relevant docs (issues + wiki, no doc_type filter — we want both)
    k = settings.chroma_retrieval_k
    raw_docs = vector_store.similarity_search(search_query, k=k)

    # If scoped to a project, prefer docs from that project but keep others as fallback
    if project_name:
        project_lower = project_name.lower()
        project_docs = [
            d
            for d in raw_docs
            if d.metadata.get("project", "").lower() == project_lower
        ]
        other_docs = [
            d
            for d in raw_docs
            if d.metadata.get("project", "").lower() != project_lower
        ]
        docs = (project_docs + other_docs)[:k]
    else:
        docs = raw_docs

    logger.info(f"Chat RAG: retrieved {len(docs)} docs for query='{message[:60]}'")

    # Build context block — live workspace stats first, then vector chunks
    context_parts = []
    if workspace_context:
        context_parts.append(workspace_context)
    for doc in docs:
        context_parts.append(doc.page_content)
    context = (
        "\n\n---\n\n".join(context_parts)
        if context_parts
        else "No relevant data found in the workspace."
    )

    # Extract source titles for citation
    source_titles = []
    for doc in docs:
        for line in doc.page_content.split("\n"):
            if line.startswith("Title: "):
                source_titles.append(line[7:].strip())
                break

    llm = get_llm(model_key="chat")
    prompt = PromptTemplate(
        template=CHATBOT_PROMPT_TEMPLATE,
        input_variables=["context", "message"],
    )

    chain = prompt | llm
    response = chain.invoke({"context": context, "message": message})

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        logger.error(f"Chat LLM returned non-JSON: {response.content[:200]}")
        result = {
            "answer": "Sorry, I had trouble processing that. Please try again.",
            "sources": [],
            "out_of_scope": False,
        }

    # Merge LLM sources with our extracted titles (LLM may hallucinate sources)
    if not result.get("sources"):
        result["sources"] = source_titles[:3]

    return result

import json
from langchain_core.prompts import PromptTemplate

from app.prompts.task_prompts import CHATBOT_QUERY_PROMPT
from app.services.rag_pipeline import get_llm, get_vector_store
from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _extract_title(page_content: str, metadata: dict) -> str:
    for line in page_content.split("\n"):
        for prefix in ("Title: ", "Name: "):
            if line.startswith(prefix):
                return line[len(prefix):].strip()
    return metadata.get("title", metadata.get("name", ""))


def _build_structured_sources(docs: list) -> list[dict]:
    seen: set[tuple] = set()
    sources = []
    for doc in docs:
        meta = doc.metadata
        doc_type = meta.get("doc_type", "")
        id_map = {
            "issue": meta.get("issue_id"),
            "wiki": meta.get("wiki_id"),
            "sprint": meta.get("sprint_id"),
            "project": meta.get("project_id"),
            "user": meta.get("user_id"),
        }
        source_id = id_map.get(doc_type)
        if not source_id or not doc_type:
            continue
        key = (doc_type, source_id)
        if key in seen:
            continue
        seen.add(key)
        title = _extract_title(doc.page_content, meta)
        if title:
            sources.append({"type": doc_type, "id": source_id, "title": title})
        if len(sources) == 3:
            break
    return sources


def chatbot_query(
    query: str,
    project_name: str | None = None,
    sprint_name: str | None = None,
    page: str | None = None,
    history: list[dict] | None = None,
    page_context: str | None = None,
) -> dict:
    settings = get_settings()
    vector_store = get_vector_store()

    # Build enriched search query so retrieval captures page and project context
    search_parts = [query]
    if project_name:
        search_parts.append(project_name)
    if page:
        search_parts.append(page)
    search_query = " ".join(search_parts)

    k = settings.chroma_retrieval_k
    raw_docs = vector_store.similarity_search(search_query, k=k)

    # Prioritise docs from the scoped project
    if project_name:
        project_lower = project_name.lower()
        project_docs = [d for d in raw_docs if d.metadata.get("project", "").lower() == project_lower]
        other_docs = [d for d in raw_docs if d.metadata.get("project", "").lower() != project_lower]
        docs = (project_docs + other_docs)[:k]
    else:
        docs = raw_docs

    # Bubble sprint-specific docs to the top when sprint is scoped
    if sprint_name:
        sprint_lower = sprint_name.lower()
        sprint_docs = [d for d in docs if sprint_lower in d.page_content.lower()]
        rest = [d for d in docs if sprint_lower not in d.page_content.lower()]
        docs = (sprint_docs + rest)[:k]

    logger.info(
        f"Chatbot query RAG: {len(docs)} docs | project={project_name} sprint={sprint_name} page={page}"
    )

    context = (
        "\n\n---\n\n".join(d.page_content for d in docs)
        if docs
        else "No relevant data found in the workspace."
    )

    # Format history (max 4 turns already enforced by caller)
    if history:
        history_text = "\n".join(
            f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
            for msg in history
        )
    else:
        history_text = "No prior conversation."

    llm = get_llm(model_key="chat")
    prompt = PromptTemplate(
        template=CHATBOT_QUERY_PROMPT,
        input_variables=["context", "query", "history", "page", "page_context"],
    )
    chain = prompt | llm
    response = chain.invoke({
        "context": context,
        "query": query,
        "history": history_text,
        "page": page or "unknown",
        "page_context": page_context or "No live page data available.",
    })

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        logger.error(f"Chatbot query LLM returned non-JSON: {response.content[:200]}")
        result = {"answer": response.content, "sources": [], "out_of_scope": False}

    # Replace LLM-generated sources with ground-truth structured sources from retrieved docs
    result["sources"] = _build_structured_sources(docs)
    result.pop("out_of_scope", None)

    return result

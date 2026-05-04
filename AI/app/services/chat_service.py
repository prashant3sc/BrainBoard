import json
from typing import TYPE_CHECKING
from langchain_core.prompts import PromptTemplate

from app.prompts.task_prompts import CHATBOT_PROMPT_TEMPLATE, WIKI_CHAT_PROMPT_TEMPLATE
from app.services.rag_pipeline import get_llm, get_vector_store
from app.config import get_settings
from app.core.logging import get_logger

if TYPE_CHECKING:
    from app.schemas import WikiContextPayload

logger = get_logger(__name__)


def chat_with_rag(
    message: str,
    project_name: str | None = None,
    workspace_context: str | None = None,
    wiki_context: "WikiContextPayload | None" = None,
) -> dict:
    """
    RAG-powered read-only chatbot.

    When wiki_context is provided (user is reading a wiki page):
    - The full page text becomes the primary context.
    - ChromaDB is still searched for supporting cross-references.
    - A focused wiki-aware prompt is used.

    Without wiki_context: standard workspace-wide RAG behaviour.
    """
    settings = get_settings()
    vector_store = get_vector_store()

    search_query = f"{message} {project_name}" if project_name else message
    k = settings.chroma_retrieval_k
    raw_docs = vector_store.similarity_search(search_query, k=k)

    if project_name:
        project_lower = project_name.lower()
        project_docs = [d for d in raw_docs if d.metadata.get("project", "").lower() == project_lower]
        other_docs   = [d for d in raw_docs if d.metadata.get("project", "").lower() != project_lower]
        docs = (project_docs + other_docs)[:k]
    else:
        docs = raw_docs

    logger.info(f"Chat RAG: retrieved {len(docs)} docs | wiki_context={'yes' if wiki_context else 'no'}")

    # ── Wiki-page mode ────────────────────────────────────────────────────────
    if wiki_context:
        # Page text is the primary source; ChromaDB docs are secondary cross-refs
        rag_snippets = "\n\n---\n\n".join(d.page_content for d in docs) if docs else ""
        prompt = PromptTemplate(
            template=WIKI_CHAT_PROMPT_TEMPLATE,
            input_variables=["page_title", "page_text", "rag_snippets", "message"],
        )
        llm = get_llm(model_key="chat")
        chain = prompt | llm
        response = chain.invoke({
            "page_title":   wiki_context.title,
            "page_text":    wiki_context.text,
            "rag_snippets": rag_snippets or "None",
            "message":      message,
        })
        source_titles = [wiki_context.title]

    # ── Standard workspace-wide mode ─────────────────────────────────────────
    else:
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

    # ── Parse LLM JSON response ───────────────────────────────────────────────
    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        logger.error(f"Chat LLM returned non-JSON: {response.content[:200]}")
        result = {
            "answer": "Sorry, I had trouble processing that. Please try again.",
            "sources": [],
            "out_of_scope": False,
        }

    if not result.get("sources"):
        result["sources"] = source_titles[:3]

    return result

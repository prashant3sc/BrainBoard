import json
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.language_models import BaseChatModel

from app.schemas import IssueDocument, WikiDocument, UserDocument, ProjectDocument, SprintDocument
from app.prompts.task_prompts import SYSTEM_PROMPT_TEMPLATE
from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class _LocalEmbeddings(Embeddings):
    """
    Thin LangChain wrapper around ChromaDB's bundled all-MiniLM-L6-v2 model.

    Runs entirely locally — no API key needed.  Used as a fallback when the
    OpenAI key is missing or invalid.
    """

    def __init__(self) -> None:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        self._fn = DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Convert numpy float32 → plain Python float (required by LangChain Chroma)
        return [[float(x) for x in v] for v in self._fn(texts)]

    def embed_query(self, text: str) -> list[float]:
        return [float(x) for x in self._fn([text])[0]]


def get_llm(model_key: str = "rag", json_mode: bool = True) -> BaseChatModel:
    """
    Return a configured LLM instance.

    Args:
        model_key:  "rag" (lower temperature, used for structured analysis) or
                    "chat" (higher temperature, used for conversational responses).
        json_mode:  When True (default) the OpenAI model is instructed to return
                    a valid JSON object.  Set to False for free-text responses
                    such as the chatbot answer in ChatbotQueryView.
                    Groq is unaffected — it does not support the response_format
                    parameter in the same way and already returns plain text.
    """
    settings = get_settings()

    if settings.use_groq and settings.groq_api_key:
        try:
            from langchain_groq import ChatGroq
            model = settings.groq_model_rag if model_key == "rag" else settings.groq_model_chat
            logger.info(f"Using Groq LLM: {model}")
            return ChatGroq(
                model=model,
                temperature=0.2 if model_key == "rag" else 0.7,
                groq_api_key=settings.groq_api_key,
            )
        except ImportError:
            logger.warning("langchain-groq not installed. Falling back to OpenAI.")

    model = settings.openai_model_rag if model_key == "rag" else settings.openai_model_chat
    max_tokens = settings.openai_max_tokens_rag if model_key == "rag" else settings.openai_max_tokens_chat
    logger.info(f"Using OpenAI LLM: {model} (json_mode={json_mode})")

    extra_kwargs: dict = {}
    if json_mode:
        extra_kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}

    return ChatOpenAI(
        model=model,
        temperature=0.2 if model_key == "rag" else 0.7,
        max_tokens=max_tokens,
        openai_api_key=settings.openai_api_key,
        **extra_kwargs,
    )



def get_vector_store() -> Chroma:
    settings = get_settings()
    return Chroma(
        collection_name=settings.chroma_collection,
        embedding_function=OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.openai_api_key,
        ),
        persist_directory=settings.chroma_db_dir,
    )


def _clear_collection(vector_store: Chroma) -> int:
    """
    Delete all documents from the collection and return the count removed.

    If the stored collection was created with a different embedding dimension
    (e.g. previously OpenAI 1536-dim, now local 384-dim), deleting individual
    documents leaves the schema locked to the old dimension.  In that case we
    drop and recreate the collection so the next add_documents call can
    initialise it with the correct dimension.
    """
    try:
        existing = vector_store._collection.get()
        existing_ids = existing.get("ids", [])
    except Exception:
        existing_ids = []

    if existing_ids:
        try:
            vector_store._collection.delete(ids=existing_ids)
        except Exception as exc:
            # Dimension mismatch or corrupted collection — drop it entirely
            logger.warning(
                "Could not delete documents from collection (%s); "
                "dropping and recreating collection.", exc
            )
            client = vector_store._client
            collection_name = vector_store._collection.name
            client.delete_collection(collection_name)
            logger.info("Collection '%s' dropped and will be recreated.", collection_name)

    return len(existing_ids)


def _issue_to_document(issue: IssueDocument) -> Document:
    labels_str = ", ".join(issue.labels) if issue.labels else "none"
    pts_str = str(issue.story_points) if issue.story_points else "unestimated"
    ticket_prefix = f"[{issue.ticket_id}] " if issue.ticket_id else ""
    return Document(
        page_content=(
            f"[ISSUE] {ticket_prefix}Project: {issue.project}\n"
            f"Ticket: {issue.ticket_id or 'N/A'}\n"
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
            "ticket_id": issue.ticket_id or "",
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
    1. Drops and recreates the ChromaDB collection (ensures correct embedding dims)
    2. Re-embeds all issues + wiki pages from Postgres

    Called by POST /ai/sync from the Django BE.
    """
    settings = get_settings()
    embeddings = _LocalEmbeddings()

    # Drop the collection entirely so the dimension is reset when recreated.
    # Sync always uses the local model (all-MiniLM-L6-v2, 384-dim, no API key).
    import chromadb as _chromadb
    _client = _chromadb.PersistentClient(path=settings.chroma_db_dir)
    try:
        existing = _client.get_collection(settings.chroma_collection)
        deleted = len(existing.get()["ids"])
        _client.delete_collection(settings.chroma_collection)
        logger.info(f"Dropped collection '{settings.chroma_collection}' ({deleted} docs)")
    except Exception:
        deleted = 0
        logger.info(f"Collection '{settings.chroma_collection}' did not exist — will create fresh")

    # Recreate the collection via LangChain so add_documents works normally
    vector_store = Chroma(
        collection_name=settings.chroma_collection,
        embedding_function=embeddings,
        persist_directory=settings.chroma_db_dir,
    )
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


def _get_logical_id(meta: dict) -> str:
    """
    Extract a stable logical ID from document metadata.
    Handles both full_sync format (issue_id, wiki_id) and
    Celery-task format (ticket_id, page_id).
    """
    return (
        meta.get("issue_id")
        or meta.get("ticket_id")
        or meta.get("wiki_id")
        or meta.get("page_id")
        or meta.get("sprint_id")
        or meta.get("user_id")
        or meta.get("project_id")
        or ""
    )


def _extract_excerpt(text: str) -> str:
    for prefix in ("Description: ", "Content: "):
        for line in text.split("\n"):
            if line.startswith(prefix):
                return line[len(prefix):].strip()[:200]
    return ""


def _extract_title_simple(text: str) -> str:
    for line in text.split("\n"):
        if line.startswith("Title: "):
            return line[7:].strip()
    return ""


def semantic_search(query: str, k: int = 10) -> list[dict]:
    """
    Hybrid semantic search (BM25 + vector + RRF) across issues and wiki pages.

    Falls back to pure vector search when rank_bm25 is not installed.
    """
    from app.services.hybrid_search import bm25_search, reciprocal_rank_fusion, is_available as bm25_available

    _ISSUE_WIKI_TYPES = {"issue", "wiki", "ticket"}
    vector_store = get_vector_store()

    # ── Build corpus for BM25 ────────────────────────────────────────────────
    # logical_id → (page_content, metadata)
    corpus: dict[str, tuple[str, dict]] = {}

    if bm25_available():
        try:
            raw = vector_store._collection.get(include=["documents", "metadatas"])
            for text, meta in zip(raw.get("documents", []), raw.get("metadatas", [])):
                doc_type = meta.get("doc_type") or meta.get("type", "")
                if doc_type in _ISSUE_WIKI_TYPES:
                    lid = _get_logical_id(meta)
                    if lid:
                        corpus[lid] = (text, meta)
        except Exception as exc:
            logger.warning(f"semantic_search: BM25 corpus fetch failed — {exc}")

    # ── Vector search (over-retrieve) ────────────────────────────────────────
    vector_k = min(k * 3, max(k, len(corpus))) if corpus else k
    vector_docs = vector_store.similarity_search(query, k=vector_k)

    vector_ids: list[str] = []
    for doc in vector_docs:
        meta = doc.metadata
        doc_type = meta.get("doc_type") or meta.get("type", "")
        if doc_type not in _ISSUE_WIKI_TYPES:
            continue
        lid = _get_logical_id(meta)
        if lid:
            vector_ids.append(lid)
            corpus.setdefault(lid, (doc.page_content, meta))

    # ── BM25 search ──────────────────────────────────────────────────────────
    bm25_ids: list[str] = []
    if bm25_available() and corpus:
        all_ids = list(corpus.keys())
        all_texts = [corpus[i][0] for i in all_ids]
        bm25_ids = bm25_search(all_texts, all_ids, query, top_k=min(k * 3, len(all_ids)))
        logger.info(f"semantic_search: hybrid — {len(vector_ids)} vector + {len(bm25_ids)} BM25 candidates")
    else:
        logger.info(f"semantic_search: pure vector — {len(vector_ids)} candidates")

    # ── RRF merge ────────────────────────────────────────────────────────────
    merged_ids = (
        reciprocal_rank_fusion(vector_ids, bm25_ids)[:k]
        if bm25_ids
        else vector_ids[:k]
    )

    # ── Build output ─────────────────────────────────────────────────────────
    results = []
    for lid in merged_ids:
        if lid not in corpus:
            continue
        text, meta = corpus[lid]
        doc_type = meta.get("doc_type") or meta.get("type", "")
        title = _extract_title_simple(text)
        excerpt = _extract_excerpt(text)

        if doc_type == "issue":
            results.append({
                "id": meta.get("issue_id", ""),
                "type": "issue",
                "title": title,
                "excerpt": excerpt,
            })
        elif doc_type == "ticket":
            results.append({
                "id": meta.get("ticket_id", ""),
                "type": "issue",
                "title": title,
                "excerpt": excerpt,
            })
        elif doc_type == "wiki":
            results.append({
                "id": meta.get("wiki_id") or meta.get("page_id", ""),
                "type": "wiki",
                "title": title or meta.get("title", ""),
                "excerpt": excerpt,
            })

    return results


def upsert_document(doc_id: str, text: str, metadata: dict) -> None:
    """
    Idempotent single-document upsert into ChromaDB.

    Deletes any pre-existing document with the same `doc_id`, then re-embeds
    and inserts it.  Called by the Django Celery embedding tasks whenever a
    ticket, wiki page, sprint, or analytics snapshot changes.

    Args:
        doc_id:   Stable, deterministic ID (e.g. "ticket_<uuid>").
        text:     Pre-built plain-text representation of the document.
        metadata: Dict of filter-friendly fields stored alongside the vector.
    """
    vector_store = get_vector_store()

    # Delete stale version if it exists
    try:
        existing = vector_store._collection.get(ids=[doc_id])
        if existing.get("ids"):
            vector_store._collection.delete(ids=[doc_id])
    except Exception as exc:
        logger.warning(f"upsert_document: delete check failed for {doc_id}: {exc}")

    # Re-embed and store with the deterministic ID
    vector_store.add_texts(texts=[text], metadatas=[metadata], ids=[doc_id])
    logger.info(f"upsert_document: upserted {doc_id} (type={metadata.get('type')})")


def _extract_title_from_doc(text: str, metadata: dict, doc_type: str) -> str:
    """
    Extract a human-readable title from a document's page_content.

    Handles both metadata formats that coexist in the collection:

    New format (Celery tasks, Step 2):
      ticket   → "Title: My Issue"
      wiki     → "Page: My Wiki Page"
      sprint   → "Sprint: My Sprint | 2025-04-01 to ..."
      analytics→ "Week of 2025-04-14. Project: Alpha"

    Old format (full_sync):
      issue    → "[ISSUE] Project: X\nTitle: My Issue"
      wiki     → "[WIKI] ...\nTitle: My Page"
      sprint   → "[SPRINT] Name: My Sprint"
      project  → "[PROJECT] Name: My Project"
      user     → "[USER] Name: Alice"
    """
    lines = text.split("\n") if text else []
    first_line = lines[0] if lines else ""

    for line in lines:
        # Both formats use "Title: " for ticket/issue
        if line.startswith("Title: "):
            return line[7:].strip()
        # Celery wiki format
        if line.startswith("Page: "):
            return line[6:].strip()
        # Old format sprint / project / user — "[TYPE] Name: …"
        if " Name: " in line and line.startswith("["):
            return line.split(" Name: ", 1)[1].strip()

    # Celery sprint first line: "Sprint: My Sprint | 2025-04-01 to 2025-04-14"
    if first_line.startswith("Sprint: "):
        segment = first_line[8:]                     # strip "Sprint: "
        return segment.split(" | ")[0].strip()       # keep just the name

    # Celery analytics first line: "Week of 2025-04-14. Project: Alpha"
    if first_line.startswith("Week of "):
        return first_line.strip()

    # Metadata fallbacks
    return metadata.get("title", metadata.get("name", ""))


def query_chromadb(
    query: str,
    project_id: str | None,
    doc_types: list[str],
    sprint_id: str | None = None,
    top_k: int = 6,
) -> list[dict]:
    """
    Targeted ChromaDB vector search with metadata pre-filtering.

    Uses the same Chroma client and ``text-embedding-3-small`` embedding model
    that the rest of the pipeline uses — no separate embedding call needed,
    ``similarity_search`` embeds the query automatically.

    Metadata filter logic
    ─────────────────────
    The filter targets the **Celery-task metadata format** written by Step 2's
    ``upsert_document`` calls:

        type       → "ticket" | "wiki" | "sprint" | "analytics"
        project_id → UUID string of the owning project
        sprint_id  → UUID string of the sprint (tickets and sprints only)

    Old ``full_sync`` documents (``doc_type`` key, ``project`` = name) are
    stored in the same collection but will not match a ``project_id`` filter
    because they lack that field — ChromaDB silently excludes them.

    Filter build rules (exactly as specified):
        * ``type in doc_types``                            — always applied
        * ``project_id == project_id``                     — when project_id given
        * ``sprint_id == sprint_id`` (tickets only)        — when sprint_id given
                                                             AND "ticket" in doc_types

    ChromaDB constraint: ``$and`` requires ≥ 2 operands; with a single
    condition the dict is used directly.

    Args:
        query:      Natural-language query string; embedded automatically.
        project_id: UUID string — restrict to this project.  None = org-wide.
        doc_types:  Document type values to include, e.g. ["ticket", "wiki"].
                    Must use Celery-format names (ticket/wiki/sprint/analytics).
        sprint_id:  UUID string — scope ticket results to a specific sprint.
                    Ignored when "ticket" is not in doc_types.
        top_k:      Maximum number of results (default 6).

    Returns:
        List of dicts: [{"type": str, "id": str, "title": str, "text": str}, …]
        Returns [] on any error — never raises.
    """
    if not doc_types:
        return []

    from app.services.hybrid_search import bm25_search, reciprocal_rank_fusion, is_available as bm25_available

    try:
        vector_store = get_vector_store()

        # ── Build ChromaDB WHERE filter ──────────────────────────────────────
        conditions: list[dict] = []

        # Type filter — always present; $in works with single-element lists too
        conditions.append({"type": {"$in": list(doc_types)}})

        # Project scope
        if project_id:
            conditions.append({"project_id": {"$eq": str(project_id)}})

        # Sprint scope — only meaningful for ticket documents
        if sprint_id and "ticket" in doc_types:
            conditions.append({"sprint_id": {"$eq": str(sprint_id)}})

        # $and requires >= 2 items; use bare dict for a single condition
        where = {"$and": conditions} if len(conditions) > 1 else conditions[0]

        logger.info(
            f"query_chromadb: query={query[:60]!r} types={doc_types} "
            f"project_id={project_id} sprint_id={sprint_id} k={top_k}"
        )

        # ── Build corpus for BM25 ─────────────────────────────────────────────
        # logical_id → (page_content, metadata)
        corpus: dict[str, tuple[str, dict]] = {}

        if bm25_available():
            try:
                raw = vector_store._collection.get(
                    where=where,
                    include=["documents", "metadatas"],
                )
                for text, meta in zip(raw.get("documents", []), raw.get("metadatas", [])):
                    lid = _get_logical_id(meta)
                    if lid:
                        corpus[lid] = (text, meta)
            except Exception as exc:
                logger.warning(f"query_chromadb: BM25 corpus fetch failed — {exc}")

        # ── Vector search (over-retrieve) ─────────────────────────────────────
        vector_k = min(top_k * 3, max(top_k, len(corpus))) if corpus else top_k
        docs = vector_store.similarity_search(query, k=vector_k, filter=where)

        vector_ids: list[str] = []
        for doc in docs:
            lid = _get_logical_id(doc.metadata)
            if lid:
                vector_ids.append(lid)
                corpus.setdefault(lid, (doc.page_content, doc.metadata))

        # ── BM25 search ───────────────────────────────────────────────────────
        bm25_ids: list[str] = []
        if bm25_available() and corpus:
            all_ids = list(corpus.keys())
            all_texts = [corpus[i][0] for i in all_ids]
            bm25_ids = bm25_search(all_texts, all_ids, query, top_k=min(top_k * 3, len(all_ids)))
            logger.info(
                f"query_chromadb: hybrid — {len(vector_ids)} vector + {len(bm25_ids)} BM25 candidates"
            )
        else:
            logger.info(f"query_chromadb: pure vector — {len(vector_ids)} candidates")

        # ── RRF merge ─────────────────────────────────────────────────────────
        merged_ids = (
            reciprocal_rank_fusion(vector_ids, bm25_ids)[:top_k]
            if bm25_ids
            else vector_ids[:top_k]
        )

    except Exception as exc:
        logger.error(
            f"query_chromadb failed for query={query[:60]!r} "
            f"project_id={project_id}: {exc}"
        )
        return []

    # ── Build output from merged ranking ────────────────────────────────────
    results: list[dict] = []
    for lid in merged_ids:
        if lid not in corpus:
            continue
        text, meta = corpus[lid]

        doc_type = meta.get("type") or meta.get("doc_type", "")

        id_lookup: dict[str, str | None] = {
            "ticket":    meta.get("ticket_id"),
            "issue":     meta.get("issue_id"),
            "wiki":      meta.get("page_id") or meta.get("wiki_id"),
            "sprint":    meta.get("sprint_id"),
            "analytics": meta.get("project_id"),
            "project":   meta.get("project_id"),
            "user":      meta.get("user_id"),
        }
        doc_id = id_lookup.get(doc_type) or ""

        title = _extract_title_from_doc(text, meta, doc_type)

        results.append({
            "type":  doc_type,
            "id":    doc_id,
            "title": title,
            "text":  text,
        })

    logger.info(f"query_chromadb: returned {len(results)} results (hybrid)")
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
    # Use more of the description so retrieval matches on actual work content, not just labels
    query = f"Labels: {labels_str}. Issue: {heading}. {description[:600]}"

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

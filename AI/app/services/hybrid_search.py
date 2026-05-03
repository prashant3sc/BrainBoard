import re
from typing import List

from app.core.logging import get_logger

logger = get_logger(__name__)

_TOKEN_RE = re.compile(r"\b\w+\b")

try:
    from rank_bm25 import BM25Okapi
    _BM25_AVAILABLE = True
except ImportError:
    _BM25_AVAILABLE = False
    logger.warning("rank_bm25 not installed — hybrid search will fall back to pure vector search")


def is_available() -> bool:
    return _BM25_AVAILABLE


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


def bm25_search(corpus_texts: List[str], corpus_ids: List[str], query: str, top_k: int) -> List[str]:
    """
    BM25 keyword search over a pre-built corpus.

    Args:
        corpus_texts: Raw text of each document (same order as corpus_ids).
        corpus_ids:   Stable logical IDs corresponding to each text.
        query:        Search query.
        top_k:        Maximum number of IDs to return.

    Returns:
        List of corpus_ids ranked by BM25 score, best first.
        Returns [] when rank_bm25 is not installed or corpus is empty.
    """
    if not _BM25_AVAILABLE or not corpus_texts:
        return []

    tokenized_corpus = [_tokenize(t) for t in corpus_texts]
    bm25 = BM25Okapi(tokenized_corpus)
    scores = bm25.get_scores(_tokenize(query))

    ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return [corpus_ids[i] for i in ranked_indices[:top_k]]


def reciprocal_rank_fusion(vector_ids: List[str], bm25_ids: List[str], k: int = 60) -> List[str]:
    """
    Merge two ranked ID lists using Reciprocal Rank Fusion.

    score(d) = Σ  1 / (k + rank(d) + 1)   for each list where d appears

    A document that ranks well in both lists gets a much higher combined score
    than one that ranks well in only one.

    Args:
        vector_ids: IDs ranked by vector similarity (best first).
        bm25_ids:   IDs ranked by BM25 keyword score (best first).
        k:          RRF constant — higher values reduce the impact of top ranks.
                    60 is the standard value from the original RRF paper.

    Returns:
        Merged list of IDs sorted by combined score, best first.
    """
    scores: dict[str, float] = {}
    for rank, doc_id in enumerate(vector_ids):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    for rank, doc_id in enumerate(bm25_ids):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda x: scores[x], reverse=True)

from fastapi import APIRouter, HTTPException

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.schemas import LlmGenerateRequest, LlmGenerateResponse
from app.services.rag_pipeline import get_llm
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["LLM"])


@router.post("/llm/generate", response_model=LlmGenerateResponse)
async def llm_generate_endpoint(request: LlmGenerateRequest):
    """
    Direct LLM invocation with a pre-built messages array.

    Accepts OpenAI-style role/content message dicts and returns the model's
    plain-text response.  Used by the Django BE's ChatbotQueryView to generate
    conversational answers after page context and ChromaDB results have been
    assembled into a system prompt on the Django side.

    Set ``json_mode=False`` (the default here) for free-text answers.
    Set ``json_mode=True`` to get a JSON object response (used by analyze-task
    and sprint-pulse endpoints internally).
    """
    if not request.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty.")

    try:
        llm = get_llm(model_key=request.model_key, json_mode=request.json_mode)

        lc_messages = []
        for msg in request.messages:
            role = msg.role.lower()
            if role == "system":
                lc_messages.append(SystemMessage(content=msg.content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
            else:
                lc_messages.append(HumanMessage(content=msg.content))

        response = llm.invoke(lc_messages)
        return {"text": response.content}

    except Exception as exc:
        logger.error(f"LLM generate failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

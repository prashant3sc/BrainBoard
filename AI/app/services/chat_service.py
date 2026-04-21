import json
from langchain_core.prompts import PromptTemplate
from app.prompts.task_prompts import CHATBOT_PROMPT_TEMPLATE
from app.services.rag_pipeline import get_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


def simple_chat(message: str) -> dict:
    """Jira Chatbot — generates Jira tickets or answers technical questions."""
    llm = get_llm(model_key="chat")

    prompt = PromptTemplate(
        template=CHATBOT_PROMPT_TEMPLATE,
        input_variables=["message"],
    )

    chain = prompt | llm
    response = chain.invoke({"message": message})

    logger.info("Chat response generated successfully.")
    return json.loads(response.content)


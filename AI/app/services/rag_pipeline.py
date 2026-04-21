import json
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.language_models import BaseChatModel

from app.schemas import TeamContextRequest
from app.prompts.task_prompts import SYSTEM_PROMPT_TEMPLATE
from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_llm(model_key: str = "rag") -> BaseChatModel:
    """
    Returns the configured LLM. Switches between OpenAI and Groq based on USE_GROQ flag.
    Groq provides sub-1-second inference for free — ideal for demos.
    """
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
        model_kwargs={"response_format": {"type": "json_object"}},
    )

def get_vector_store() -> Chroma:
    """Returns the ChromaDB vector store instance."""
    settings = get_settings()
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    return Chroma(
        collection_name=settings.chroma_collection,
        embedding_function=embeddings,
        persist_directory=settings.chroma_db_dir,
    )


def add_team_member(context: TeamContextRequest) -> str:
    """Adds a team member profile to the vector DB."""
    vector_store = get_vector_store()

    # Mathematical calculation: 1 Point = 1 Working day.
    actual_capacity = context.total_working_days - context.current_workload

    skills_str = ", ".join(context.skills)
    text_content = (
        f"Team Member: {context.member_name}\n"
        f"Role: {context.role}\n"
        f"Sprint Total Days: {context.total_working_days}\n"
        f"Occupied Workload (Story Points/Days): {context.current_workload}\n"
        f"Available Capacity (Story Points/Days): {actual_capacity}\n"
        f"Skills: {skills_str}"
    )

    doc = Document(
        page_content=text_content,
        metadata={"member_name": context.member_name, "role": context.role},
    )
    vector_store.add_documents([doc])

    # Explicitly persist to filesystem
    if hasattr(vector_store, "persist"):
        vector_store.persist()

    logger.info(
        f"Added team member: {context.member_name} | Capacity: {actual_capacity} pts"
    )
    return f"Successfully added {context.member_name} to knowledge base."


def analyze_task_with_rag(heading: str, description: str) -> dict:
    """Retrieves team context via RAG and calls LLM to analyze the task."""
    settings = get_settings()
    vector_store = get_vector_store()

    query = f"Task: {heading}. Details: {description}"
    retrieved_docs = vector_store.similarity_search(query, k=settings.chroma_retrieval_k)
    team_context = "\n\n".join([doc.page_content for doc in retrieved_docs])

    logger.info(f"RAG retrieved {len(retrieved_docs)} team member profiles for context.")

    llm = get_llm(model_key="rag")

    prompt = PromptTemplate(
        template=SYSTEM_PROMPT_TEMPLATE,
        input_variables=["team_context", "heading", "description"],
    )

    chain = prompt | llm
    response_msg = chain.invoke({
        "team_context": team_context,
        "heading": heading,
        "description": description,
    })

    return json.loads(response_msg.content)

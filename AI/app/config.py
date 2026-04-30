from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# BrainBoard root is 3 levels up from this file (AI/app/config.py)
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    """Central configuration for JiraGenie AI.
    All values are loaded from the .env file automatically.
    """

    # --- Application ---
    app_name: str = "JiraGenie AI"
    app_version: str = "1.0.0"
    debug: bool = False

    # --- Security ---
    # Clients (frontend) must send: X-API-Key: <this value>
    app_api_key: str = "dev-secret-key-change-in-production"

    # --- OpenAI ---
    openai_api_key: str
    openai_model_rag: str = "gpt-4o-mini"   # Faster for structured JSON output
    openai_model_chat: str = "gpt-4o-mini"     # Smarter for chatbot responses
    openai_max_tokens_rag: int = 1200   # analyze-task JSON needs ~800-1000 tokens
    openai_max_tokens_chat: int = 500

    # --- Groq (Optional: Ultra-fast alternative LLM provider) ---
    # Sign up free at https://console.groq.com and set GROQ_API_KEY in .env
    # Models: "llama3-8b-8192" (fastest) | "llama-3.3-70b-versatile" (smarter)
    groq_api_key: str = ""
    groq_model_rag: str = "llama3-8b-8192"
    groq_model_chat: str = "llama3-8b-8192"
    use_groq: bool = False   # Set USE_GROQ=true in .env to switch to Groq

    # --- ChromaDB ---
    chroma_db_dir: str = "./chroma_db"
    chroma_collection: str = "team_context"
    chroma_retrieval_k: int = 10

    # --- Sprint Defaults ---
    default_sprint_days: int = 11

    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Returns a cached Settings instance. Use this everywhere."""
    return Settings()

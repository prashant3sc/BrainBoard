from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

from app.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
from app.routers.v1 import team, tasks, chat, search, sprint_pulse, chatbot, embed, chromadb, llm

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — runs startup and shutdown logic."""
    setup_logging(debug=settings.debug)
    logger = get_logger("jiragenie.startup")
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    yield
    logger.info(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    description="""
## JiraGenie AI — Agile Project Management Assistant

**Authentication**: All endpoints require an `X-API-Key` header.

> Click the **🔓 Authorize** button above, enter your API Key (e.g. `jiragenie-demo-key`), then click **Authorize**.

---
### Endpoints:
- `/api/v1/team/upload-context` — Add a team member to the knowledge base
- `/api/v1/tasks/analyze` — Analyze a Jira task (RAG + LLM)
- `/api/v1/chat/` — Jira chatbot (generate ticket or answer questions)
""",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={"persistAuthorization": True},
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Exception Handlers ---
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# --- Routers ---
app.include_router(team.router)
app.include_router(tasks.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(sprint_pulse.router)
app.include_router(chatbot.router)
app.include_router(embed.router)
app.include_router(chromadb.router)
app.include_router(llm.router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }

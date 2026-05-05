from fastapi import APIRouter, HTTPException
import os

from app.schemas import JiraTaskRequest, TeamContextRequest, ChatRequest, JiraTaskResponse, ChatbotJiraResponse
from app.services.rag_pipeline import add_team_member, analyze_task_with_rag
from app.services.chat_service import simple_chat

api_router = APIRouter()

@api_router.get("/health")
async def health_check():
    """Health check endpoint to verify server is running."""
    return {"status": "healthy", "service": "JiraGenie AI"}

@api_router.post("/upload-context")
async def upload_context(context: TeamContextRequest):
    """
    Endpoint to save a team member's capacity, skills, and workload into the Vector Database.
    This builds the 'knowledge base' for the RAG component.
    """
    try:
        if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
            raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")
            
        result_message = add_team_member(context)
        return {"message": result_message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analyze-task", response_model=JiraTaskResponse)
async def analyze_task(request: JiraTaskRequest):
    """
    Endpoint that takes a Jira Task heading and description.
    It retrieves relevant team context via RAG and calls the LLM to generate estimations and assignments.
    """
    try:
        if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
            raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")
            
        result_data = analyze_task_with_rag(request.heading, request.description, request.labels)
        return result_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/chat", response_model=ChatbotJiraResponse)
async def chat(request: ChatRequest):
    """
    A specific Jira generation chat endpoint. Matches the Chatbot schema.
    """
    try:
        if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
            raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")
            
        response_data = simple_chat(request.message)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

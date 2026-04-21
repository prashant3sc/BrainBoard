# Schema definitions
from pydantic import BaseModel
from typing import List, Dict

class JiraTaskRequest(BaseModel):
    heading: str
    description: str

class TeamContextRequest(BaseModel):
    member_name: str
    role: str
    skills: List[str]
    total_working_days: int = 11
    current_workload: int

class ChatRequest(BaseModel):
    message: str

class JiraTaskResponse(BaseModel):
    story_points: float
    justification: str
    required_roles: List[str]
    capacity_analysis: str
    recommended_team: Dict[str, str]

class ChatbotJiraResponse(BaseModel):
    logical_thinking: str
    jira_summary: str
    jira_description: str

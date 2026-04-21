import requests
import time

API_URL = "http://localhost:8000/upload-context"
HEADERS = {"X-API-Key": "jiragenie-demo-key"}

# Dummy data representing the team
team_members = [
    {
        "member_name": "Malaya Panda",
        "role": "Data Scientist",
        "skills": ["Machine Learning", "Data Analysis", "Python", "SQL", "Forecasting"],
        "total_working_days": 11,
        "current_workload": 6
    },
    {
        "member_name": "Naman Mishra",
        "role": "MLOps",
        "skills": ["MLOps", "MLflow", "Python Backend", "Docker", "API Development", "CI/CD", "Model Deployment"],
        "total_working_days": 11,
        "current_workload": 8
    },
    {
        "member_name": "Harsh Malik",
        "role": "Backend Engineer",
        "skills": ["Python Backend", "FastAPI", "Database Design"],
        "total_working_days": 11,
        "current_workload": 5
    },
    {
        "member_name": "Bunesh Authenkar",
        "role": "Data Scientist",
        "skills": ["Data Science", "Statistics", "Model Training", "Deep Learning"],
        "total_working_days": 11,
        "current_workload": 9
    },
    {
        "member_name": "Prashanta Poonia",
        "role": "Frontend Developer",
        "skills": ["Frontend", "React", "JavaScript", "CSS"],
        "total_working_days": 11,
        "current_workload": 3
    },
    {
        "member_name": "Vishal Jadhav",
        "role": "Project Manager",
        "skills": ["Project Management", "Agile", "Scrum", "Jira"],
        "total_working_days": 11,
        "current_workload": 4
    }
]

print("Starting to populate Vector Database...")

for member in team_members:
    try:
        response = requests.post(API_URL, json=member, headers=HEADERS)
        if response.status_code == 200:
            print(f"✅ Successfully added: {member['member_name']} (Capacity: {11 - member['current_workload']} points available)")
        else:
            print(f"❌ Failed to add {member['member_name']}: {response.text}")
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to API. Is your FastAPI server running?")
        break
    
    # Small delay so we don't bombard the API and vector DB
    time.sleep(0.5)

print("\nFinished seeding data! You can now test the /analyze-task endpoint.")

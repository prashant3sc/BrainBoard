import requests
import json

BASE_URL = "http://localhost:8000"
HEADERS = {"X-API-Key": "jiragenie-demo-key"}


def test_chat_endpoint():
    print("--- 1. Testing Jira Chatbot Generation (/api/v1/chat/) ---")
    payload = {
        "message": "Create a task for migrating our user database from SQLite to PostgreSQL. We need to backup everything first, then change the ORM dialect, and fully test the read/write speeds afterward."
    }

    response = requests.post(f"{BASE_URL}/chat", json=payload, headers=HEADERS)
    if response.status_code == 200:
        print("✅ Chat Endpoint Success!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ Failed! Error {response.status_code}: {response.text}")


def test_rag_analyze_endpoint():
    print("\n--- 2. Testing Agile Assignment & Estimation (/api/v1/tasks/analyze) ---")
    payload = {
        "heading": "-ve bias issue observe in jk",
        "description": "we are observing some -ve bias issue last 3 month need a detailed rca"
    }

    response = requests.post(f"{BASE_URL}/analyze-task", json=payload, headers=HEADERS)
    if response.status_code == 200:
        print("✅ Analyze Task Success!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ Failed! Error {response.status_code}: {response.text}")


if __name__ == "__main__":
    print("Beginning tests...\n")
    test_chat_endpoint()
    test_rag_analyze_endpoint()

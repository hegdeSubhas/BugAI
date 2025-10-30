import os
import httpx
import json
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from typing import List, Optional
from datetime import datetime

# --- 1. Configuration ---
# Load settings from .env file
class Settings(BaseSettings):
    google_api_key: str
    mongodb_url: str

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields in .env

settings = Settings()

# --- 2. Database Models ---
class AnalysisResult(BaseModel):
    id: str
    language: str
    timestamp: str
    explanation: str
    bugCount: int
    fullData: dict # Store the raw analysis data

class AnalysisRequest(BaseModel):
    code: str
    language: str
    languageMime: str

# --- 3. FastAPI App & Database ---
app = FastAPI(title="BugAI Backend")

# Connect to MongoDB on startup
@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = AsyncIOMotorClient(settings.mongodb_url)
    app.mongodb = app.mongodb_client["bugai_db"]
    print("Connected to MongoDB...")

@app.on_event("shutdown")
async def shutdown_db_client():
    app.mongodb_client.close()

# --- 4. API Endpoint to Analyze Code ---
# This is the new endpoint your frontend will call
@app.post("/api/analyze")
async def analyze_code(request: AnalysisRequest = Body(...)):
    
    # 1. Define the prompts for the Gemini API
    system_prompt = """
You are an expert code reviewer. Analyze the user's code.
Respond ONLY in valid JSON format with the following structure:
{
  "bugs": [
    {
      "description": "Describe the bug, issue, or logical error clearly.",
      "line": 10,
      "severity": "high|medium|low"
    }
  ],
  "suggestions": ["Suggestion 1 for improvement.", "Suggestion 2 for improvement."],
  "explanation": "A brief summary of the code's quality, main issues, and overall suggestions.",
  "correctedCode": "Provide a version of the code with the most critical bugs fixed. If no bugs are found or corrections aren't feasible, return the original code or an empty string."
}
"""
    user_prompt = f"""
Analyze the following {request.language} code for bugs, logical errors, and improvement suggestions. Also provide a corrected version of the code.

Code:
```{request.language}
{request.code}
```
"""  # <--- THIS IS THE FIX: Added closing triple quotes

    # 2. Prepare the request to Google API
    # --- THIS IS THE FIX ---
    # The model name has been corrected
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key={settings.google_api_key}"

    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
    }

    # 3. Call the Google API securely from the backend
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, json=payload, headers={"Content-Type": "application/json"})
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Google API Error: {response.text}")
                
            result = response.json()
            
            # 4. Extract the JSON text
            if not result.get("candidates"):
                raise HTTPException(status_code=500, detail="Invalid API response structure from Google.")
            
            response_text = result["candidates"][0]["content"]["parts"][0]["text"]
            
            json_text = response_text
            # Try to find the JSON block
            try:
                if "```json" in response_text:
                    json_text = response_text.split("```json\n")[1].split("\n```")[0]
                elif "```" in response_text:
                    json_text = response_text.split("```\n")[1].split("\n```")[0]

                # A fallback to find the first and last brace
                if not json_text.strip().startswith("{"):
                    start = response_text.find("{")
                    end = response_text.rfind("}") + 1
                    if start != -1 and end != -1:
                        json_text = response_text[start:end]
                    else:
                         raise ValueError("No JSON object found")

                analysis_data = json.loads(json_text)
            
            except Exception as parse_error:
                print(f"Failed to parse JSON response: {parse_error}")
                print(f"Raw response was: {response_text}")
                raise HTTPException(status_code=500, detail="Failed to parse response from AI. Retrying may help.")

            # 5. Prepare data to save in our DB
            timestamp = datetime.now().isoformat()
            history_entry = {
                "id": timestamp,
                "language": request.language,
                "timestamp": timestamp,
                "explanation": analysis_data.get("explanation", "No explanation.")[:75] + '...',
                "bugCount": len(analysis_data.get("bugs", [])),
                "fullData": {
                    **analysis_data,
                    "code": request.code,
                    "language": request.language,
                    "languageMime": request.languageMime,
                    "timestamp": timestamp,
                }
            }
            
            # 6. Save to MongoDB
            await app.mongodb.history.insert_one(history_entry)
            
            # 7. Return the raw analysis data to the frontend
            return analysis_data

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 5. API Endpoints for History ---
@app.get("/api/history", response_model=List[AnalysisResult])
async def get_history():
    history_cursor = app.mongodb.history.find().sort("timestamp", -1).limit(20)
    history = await history_cursor.to_list(length=20)
    return history

@app.delete("/api/history")
async def clear_history():
    result = await app.mongodb.history.delete_many({})
    return {"deleted_count": result.deleted_count}

# --- 6. Serve the Frontend ---
# Mount the 'static' folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve the index.html file for the root URL
@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("static/index.html") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Frontend file not found</h1><p>Make sure 'static/index.html' exists.</p>", status_code=404)


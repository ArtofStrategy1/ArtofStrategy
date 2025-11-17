import os
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Groq API Key environment variable.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable not set.")

app = FastAPI(
    title="Groq API request handler.",
    description="Receives API request for Groq from frontend and processes the request.",
    version="1.0.0"
)

# --- CORS Configuration ---
# This allows the data2int.com frontend to connect to this FastAPI backend and for the n8n
# webhook to send data to this Fast
origins = [
    "https://data2int.com",
    "https://n8n.data2int.com",  # n8n might send preflight OPTIONS requests
    "https://matt.data2int.com",
    "https://khaled.data2int.com",
    "https://elijah.data2int.com",
    "https://mohammed.data2int.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.data2int\.com",   # # allow any subdomain of data2int.com
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, WebSocket)
    allow_headers=["*"],  # Allow all headers
)

# Pydantic Model for Incoming Request Body.
# Define the structure of the JSON payload sent from the frontend.
class ChatRequest(BaseModel):
    # Groq uses the messages array.
    messages: list = Field(..., example=[{"role": "user", "content": "Analyze the given document."}])
    model: str = "llama-3.1-8b-instant"
    stream: bool = False
    response_format: dict = {"type": "json_object"} # Optional: Set to ensure JSON response


# Secure Proxy Endpoint
@app.post("/api/groq/chat")
async def groq_chat_proxy(request_body: ChatRequest):
    # Use httpx.AsyncClient for asynchronous requests.
    async with httpx.AsyncClient() as client:
        try:
            # Construct the Groq API Request.
            groq_response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}", # Use retrieved Groq API Key.
                    "Content-Type": "application/json",
                },
                json=request_body.model_dump(by_alias=True) # Convert Pydantic model to JSON dict.
            )
            
            # Check for Groq API errors (e.g., invalid key, model not found).
            groq_response.raise_for_status()

            # Return Groq's response body directly to the frontend client.
            return groq_response.json()

        except httpx.HTTPStatusError as e:
            # Propagate error status and details to the client.
            raise HTTPException(status_code=e.response.status_code, detail=f"Groq API Error: {e.response.text}")
        except Exception as e:
            # Handle unexpected errors.
            raise HTTPException(status_code=500, detail=f"Proxy internal error: {e}")
        

# Health Check / Root Endpoint.
@app.get("/")
async def root():
    return {"message": "FastAPI Listener is running!"}
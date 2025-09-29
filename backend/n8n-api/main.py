from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="n8n Workflow Listener",
    description="Receives workflow results from n8n and broadcasts to WebSockets.",
)

# --- CORS Configuration ---
# This allows the data2int.com frontend to connect to this FastAPI backend and for the n8n
# webhook to send data to this Fast
origins = [
    "https://data2int.com",
    "https://n8n.data2int.com",  # n8n might send preflight OPTIONS requests
    "https://mohammed.data2int.com",
    "https://matt.data2int.com",
    "https://khaled.data2int.com",
    "https://elijah.data2int.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.data2int\.com",   # # allow any subdomain of data2int.com
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, WebSocket)
    allow_headers=["*"],  # Allow all headers
)


# --- WebSocket Manager ---
# Manages active WebSocket connections to broadcast messages
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected: {websocket.client}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                self.disconnect(connection)  # Clean up disconnected clients
            except Exception as e:
                logger.error(
                    f"Error broadcasting to WebSocket {connection.client}: {e}"
                )


manager = ConnectionManager()


# --- HTTP Endpoint for n8n Webhook ---
# This endpoint receives the POST request from the n8n workflow.
@app.post("/n8n-workflow-result")
async def receive_n8n_result(request: Request):
    try:
        # Read the raw JSON body
        body = await request.json()
        logger.info(f"Received data from n8n: {json.dumps(body, indent=2)}")

        # Broadcast the received data to all connected WebSocket clients
        await manager.broadcast(json.dumps(body))

        return {"status": "success", "message": "Result received and broadcasted"}
    except json.JSONDecodeError:
        logger.error("Received non-JSON data from n8n webhook.")
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        logger.error(f"Error processing n8n result: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- WebSocket Endpoint for Frontend ---
# This endpoint allows the HTML page to establish a real-time connection.
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive by waiting for messages.
            # Culd also process messages from the client here if needed.
            data = await websocket.receive_text()
            logger.info(f"Received message from WebSocket client: {data}")
            # Optionally, echo back or process client messages
            # await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)  # Ensure disconnection on other errors


# --- Health Check / Root Endpoint (Optional) ---
@app.get("/")
async def root():
    return {"message": "FastAPI Listener is running!"}

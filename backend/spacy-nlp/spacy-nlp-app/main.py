from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.nlp_model import lifespan
from .api.endpoints import nlp_router, analysis_router, graph_router, performance_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Initialize the FastAPI application.
app = FastAPI(
    title="spaCy NLP Service",
    description="A dedicated service for Natural Language Processing tasks using spaCy.",
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS Configuration ---
# This allows the data2int.com frontend to connect to this FastAPI backend and for the n8n
# webhook to send data to this Fast
origins = [
    "https://data2int.com",
    "https://n8n.data2int.com",  # n8n might send preflight OPTIONS requests
	"https://matt.data2int.com",
	"http://100.69.21.70:8102",
	"https://matt-nlp.data2int.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, WebSocket)
    allow_headers=["*"],  # Allow all headers
)

app.include_router(nlp_router)
app.include_router(analysis_router)
app.include_router(graph_router)
app.include_router(performance_router)

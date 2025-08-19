from fastapi import FastAPI
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

app.include_router(nlp_router)
app.include_router(analysis_router)
app.include_router(graph_router)
app.include_router(performance_router)

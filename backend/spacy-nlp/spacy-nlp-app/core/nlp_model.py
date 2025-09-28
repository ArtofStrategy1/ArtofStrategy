from fastapi import HTTPException
from contextlib import asynccontextmanager
import spacy
from fastcoref import spacy_component
import logging

from ..database.neo4j_connection import neo4j_connection

# Configure logging for the application.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variable to hold the spaCy NLP model.
nlp = None


@asynccontextmanager
async def lifespan(app):
    """
    Manages the lifecycle of the FastAPI application, specifically handling
    startup and shutdown events. This context manager is used to load the
    spaCy NLP model and connect to Neo4j when the application starts,
    and release resources when it shuts down.
    This ensures models and database connections are available for all requests
    and resources are properly managed.
    """
    # Connect to Neo4j database
    logger.info("Attempting to connect to Neo4j database...")
    neo4j_connection.connect()
    if neo4j_connection.get_driver() is None:
        logger.error("Failed to establish Neo4j connection during startup.")
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database.")
    logger.info("Neo4j connection established successfully during startup.")

    try:
        # Define the spaCy model name to be loaded. 'en_core_web_sm' is a
        # small English model that includes tokenization, POS tagging,
        # dependency parsing, and named entity recognition.
        model_name = "en_core_web_md" # Using a transformer-based model for better performance and compatibility with spacy-transformers
        logger.info(f"Attempting to load spaCy model: {model_name}")
        app.state.nlp = spacy.load(model_name)
        app.state.nlp.add_pipe("fastcoref")
        logger.info("Successfully added fastcoref to spaCy pipeline.")
        logger.info(f"Successfully loaded spaCy model: {model_name}")
    except OSError:
        # If the model is not found locally, attempt to download it.
        # This ensures the service can self-recover if the model is missing.
        logger.error(f"SpaCy model '{model_name}' not found. Downloading it...")
        try:
            spacy.cli.download(model_name)
            app.state.nlp = spacy.load(model_name)
            app.state.nlp.add_pipe("fastcoref")
            logger.info(f"Successfully downloaded and loaded spaCy model: {model_name}")
        except Exception as e:
            # Log and raise an HTTPException if model download or loading fails,
            # preventing the application from starting in an unready state.
            logger.error(f"Error downloading or loading spaCy model: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to load spaCy model: {e}"
            )
    except Exception as e:
        # Catch any other unexpected errors during model loading.
        logger.error(f"An unexpected error occurred during spaCy model loading: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load spaCy model: {e}")

    # The 'yield' statement indicates that the startup phase is complete,
    # and the application is ready to receive requests.
    yield

    # This block executes when the application is shutting down.
    # It releases the loaded spaCy model and closes the Neo4j connection,
    # freeing up resources.
    logger.info("Application is shutting down.")
    nlp = None
    logger.info("Closing Neo4j database connection.")
    neo4j_connection.close()

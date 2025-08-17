from fastapi import HTTPException
from contextlib import asynccontextmanager
import spacy
import logging

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
    spaCy NLP model when the application starts and release it when it shuts down.
    This ensures the model is available for all requests and resources are
    properly managed.
    """
    global nlp
    try:
        # Define the spaCy model name to be loaded. 'en_core_web_sm' is a
        # small English model that includes tokenization, POS tagging,
        # dependency parsing, and named entity recognition.
        model_name = "en_core_web_sm"
        logger.info(f"Attempting to load spaCy model: {model_name}")
        nlp = spacy.load(model_name)
        logger.info(f"Successfully loaded spaCy model: {model_name}")
    except OSError:
        # If the model is not found locally, attempt to download it.
        # This ensures the service can self-recover if the model is missing.
        logger.error(f"SpaCy model '{model_name}' not found. Downloading it...")
        try:
            spacy.cli.download(model_name)
            nlp = spacy.load(model_name)
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
    # It releases the loaded spaCy model, freeing up resources.
    logger.info("Application is shutting down.")
    nlp = None

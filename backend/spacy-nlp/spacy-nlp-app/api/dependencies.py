import os
import httpx
from fastapi import Request, Header, HTTPException, Depends
from ..database.neo4j_crud import Neo4jCRUD
import logging

# Configure logging for the application.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration for Supabase Edge Function
SUPABASE_VALIDATE_JWT_URL = os.getenv("SUPABASE_VALIDATE_JWT_URL", "https://supabase.data2int.com/functions/v1/validate-jwt-v2")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY", "supabase-api-key")

async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Validates the JWT token using a Supabase Edge Function and extracts the user_id.
    The 'Authorization' header is expected to be in the format 'Bearer <token>'.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated: Bearer token required.")

    # Forward the Authorization header to the Supabase Edge Function
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_API_KEY
    }
    payload = {
        "headers": {
            "authorization": authorization
        },
        "body": {
            "source": "spacy-nlp-service"
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(SUPABASE_VALIDATE_JWT_URL, headers=headers, json=payload)
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            validation_result = response.json()

            if validation_result.get("success") and validation_result.get("authenticated_user"):
                user_id = validation_result["authenticated_user"]["id"]
                if user_id:
                    return user_id
                else:
                    raise HTTPException(status_code=401, detail="User ID not found in validated token.")
            else:
                # Log the full validation_result for debugging if needed
                # logger.error(f"JWT validation failed: {validation_result}")
                raise HTTPException(status_code=401, detail="Not authenticated: Invalid token or validation failed.")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase JWT validation service unreachable: {exc}")
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=f"Supabase JWT validation failed: {exc.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred during JWT validation: {e}")

def get_nlp_model(request: Request):
    return request.app.state.nlp

# def get_neo4j_crud() -> Neo4jCRUD:
#     return Neo4jCRUD()

def get_neo4j_crud(user_id: str = Depends(get_current_user_id)) -> Neo4jCRUD:
    """
    Dependency that provides a Neo4jCRUD instance initialized with the validated user_id.
    """
    logger.info(f"Attempting to connect to Neo4j database as user {user_id}")
    return Neo4jCRUD(user_id=user_id)


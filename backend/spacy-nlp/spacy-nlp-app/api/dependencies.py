from fastapi import Request, Header, HTTPException
from ..database.neo4j_crud import Neo4jCRUD

def get_nlp_model(request: Request):
    return request.app.state.nlp

# def get_neo4j_crud() -> Neo4jCRUD:
#     return Neo4jCRUD()

def get_neo4j_crud(user_id: str = Header(..., alias="x-user-id")) -> Neo4jCRUD:
    """
    Dependency that provides a Neo4jCRUD instance initialized with the user_id from the request header.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="X-User-ID header is required.")
    return Neo4jCRUD(user_id=user_id)


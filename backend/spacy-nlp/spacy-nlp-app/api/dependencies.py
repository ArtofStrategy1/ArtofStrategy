from fastapi import Request
from ..database.neo4j_crud import Neo4jCRUD

def get_nlp_model(request: Request):
    return request.app.state.nlp

def get_neo4j_crud() -> Neo4jCRUD:
    return Neo4jCRUD()


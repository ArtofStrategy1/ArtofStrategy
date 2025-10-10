from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class Node(BaseModel):
    user_id: str    # User's authenticated ID.
    id: Optional[str] = None  # Neo4j internal ID, or a custom unique ID
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class Relationship(BaseModel):
    id: Optional[str] = None  # Neo4j internal ID, or a custom unique ID
    user_id: str    # User's authenticated ID.
    source_id: str  # ID of the source node
    source_label: Optional[str] = None
    target_id: str  # ID of the target node
    target_label: Optional[str] = None
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeGraph(BaseModel):
    user_id: str    # User's authenticated ID.
    nodes: List[Node]
    relationships: List[Relationship]

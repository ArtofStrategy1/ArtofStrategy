from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class Node(BaseModel):
    id: Optional[str] = None  # Neo4j internal ID, or a custom unique ID
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class Relationship(BaseModel):
    id: Optional[str] = None  # Neo4j internal ID, or a custom unique ID
    source_id: str  # ID of the source node
    source_label: Optional[str] = None
    target_id: str  # ID of the target node
    target_label: Optional[str] = None
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeGraph(BaseModel):
    nodes: List[Node]
    relationships: List[Relationship]

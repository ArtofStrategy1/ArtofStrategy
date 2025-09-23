from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class TextInput(BaseModel):
    """
    Request model for processing text.
    """

    text: str


class NamedEntity(BaseModel):
    """
    Model for a recognized named entity.
    """

    text: str
    label: str
    start_char: int
    end_char: int


class ProcessedToken(BaseModel):
    """
    Model for a processed token.
    """

    token: str
    lemma: str
    pos: str
    dep: str
    head: str
    is_stop: bool
    is_alpha: bool


class ProcessedText(BaseModel):
    """
    Response model for processed text.
    """

    original_text: str
    entities: List[NamedEntity]
    tokens: Optional[List[ProcessedToken]] = None
    sentences: List[str]


class SWOTAnalysisResult(BaseModel):
    """
    Model for SWOT analysis results.
    """

    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]


class GraphNode(BaseModel):
    """
    Model for a node in the knowledge graph, aligned with Neo4j's structure.
    """

    id: str
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphRelationship(BaseModel):
    """
    Model for a relationship in the knowledge graph, aligned with Neo4j's structure.
    """

    source_id: str
    target_id: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeGraph(BaseModel):
    """
    Model for a knowledge graph, containing nodes and relationships, aligned with Neo4j's structure.
    """

    nodes: List[GraphNode]
    relationships: List[GraphRelationship]


class RelationshipTriple(BaseModel):
    """
    Model for a subject-verb-object triple representing a relationship.
    """

    subject: str
    relation: str
    object: str
    source_document_id: Optional[str] = None
    relation_type: Optional[str] = None  # e.g., "CAUSAL", "TEMPORAL", etc.
    confidence: Optional[float] = None
    relation_metadata: Optional[Dict[str, Any]] = None


class ExtractedRelationships(BaseModel):
    """
    Response model for extracted relationships.
    """

    relationships: List[RelationshipTriple]
    graph: Optional[KnowledgeGraph] = None


class PerformanceTestRequest(BaseModel):
    """
    Request model for performance testing.
    """

    text: str
    num_iterations: int = 100


class PerformanceTestResult(BaseModel):
    """
    Response model for performance test results.
    """

    average_processing_time_ms: float
    total_processing_time_s: float


class GraphQueryRequest(BaseModel):
    """
    Request model for querying neighbors in the graph.
    """

    node_id: str


class PathQueryRequest(BaseModel):
    """
    Request model for querying paths in the graph.
    """

    source_node_id: str
    target_node_id: str


class NeighborsResponse(BaseModel):
    """
    Response model for graph neighbors.
    """

    neighbors: List[str]


class PathResponse(BaseModel):
    """
    Response model for graph path.
    """

    path: List[str]


class LeveragePoint(BaseModel):
    """
    Model for an identified leverage point in the graph.
    """

    node_id: str
    centrality_score: float


class LeveragePointsResponse(BaseModel):
    """
    Response model for identified leverage points.
    """

    leverage_points: List[LeveragePoint]


class CentralityResponse(BaseModel):
    """
    Response model for centrality calculations.
    """

    degree_centrality: Dict[str, float]
    betweenness_centrality: Optional[Dict[str, float]]
    eigenvector_centrality: Optional[Dict[str, float]]


class CommunityDetectionResponse(BaseModel):
    """
    Response model for community detection.
    """

    communities: List[List[str]]


class GraphFilterRequest(BaseModel):
    """
    Request model for filtering graph data.
    """

    source_document_id: Optional[str] = None
    node_type: Optional[str] = None
    relation_type: Optional[str] = None


class GraphNodesResponse(BaseModel):
    """
    Response model for retrieving a list of graph nodes.
    """

    nodes: List[GraphNode]


class GraphRelationshipsResponse(BaseModel):
    """
    Response model for retrieving a list of graph relationships.
    """

    relationships: List[GraphRelationship]


class KnowledgeGraphQueryResponse(BaseModel):
    """
    Response model for querying the knowledge graph based on a text query.
    """

    nodes: List[GraphNode]
    relationships: List[GraphRelationship]


class GraphProjectionRequest(BaseModel):
    """
    Request model for specifying graph projection parameters for GDS algorithms.
    """
    graph_name: str = Field(
        #default='knowledge_graph',
        description="Name of the GDS in-memory graph projection."
    )
    relationship_property_filter: Dict[str, str] = Field(
        description="Dictionary containing 'key' and 'value' to filter relationships for the graph projection."
    )
    


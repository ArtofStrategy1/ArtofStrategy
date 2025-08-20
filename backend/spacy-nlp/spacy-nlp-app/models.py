from pydantic import BaseModel
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

    text: str
    lemma: str
    pos: str
    dep: str
    is_stop: bool
    is_alpha: bool


class DependencyRelation(BaseModel):
    """
    Model for a dependency relation.
    """

    token: str
    dependency: str
    head: str


class ProcessedText(BaseModel):
    """
    Response model for processed text.
    """

    original_text: str
    entities: List[NamedEntity]
    tokens: List[ProcessedToken]
    sentences: List[str]
    dependencies: List[DependencyRelation]


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
    Model for a node in the knowledge graph.
    """

    id: str
    label: Optional[str] = None
    type: Optional[str] = None
    source_document_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    """
    Model for an edge in the knowledge graph.
    """

    source: str
    target: str
    label: str
    relation_type: Optional[str] = None
    source_document_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class KnowledgeGraph(BaseModel):
    """
    Model for a knowledge graph, containing nodes and edges.
    """

    nodes: List[GraphNode]
    edges: List[GraphEdge]


class RelationshipTriple(BaseModel):
    """
    Model for a subject-verb-object triple representing a relationship.
    """

    subject: str
    relation: str
    object: str
    source_document_id: Optional[str] = None


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
    betweenness_centrality: Dict[str, float]
    eigenvector_centrality: Dict[str, float]


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


class GraphEdgesResponse(BaseModel):
    """
    Response model for retrieving a list of graph edges.
    """

    edges: List[GraphEdge]


class KnowledgeGraphQueryResponse(BaseModel):
    """
    Response model for querying the knowledge graph based on a text query.
    """

    nodes: List[GraphNode]
    edges: List[GraphEdge]

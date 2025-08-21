import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import networkx as nx
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    TextInput,
    SWOTAnalysisResult,
    ProcessedText,
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphEdge,
    KnowledgeGraphQueryResponse,
    KnowledgeGraph,
    GraphQueryRequest,
    PathQueryRequest,
    NeighborsResponse,
    PathResponse,
    LeveragePoint,
    LeveragePointsResponse,
    PerformanceTestRequest,
    PerformanceTestResult,
    CentralityResponse,
    CommunityDetectionResponse,
    GraphFilterRequest,
    GraphNodesResponse,
    GraphEdgesResponse,
)

from ..api.dependencies import get_nlp_model, get_db_session
from ..core.processing import process_text_logic
from ..services.swot_service import perform_swot_analysis
from ..services.relationship_service import (
    extract_relationships_logic,
    get_networkx_graph_from_relationships,
)
from ..services.graph_query_service import (
    query_neighbors_logic,
    query_shortest_path_logic,
    query_centrality_measures_logic,
    query_community_detection_logic_louvain,
    query_community_detection_logic_girvan_newman,
    get_all_nodes_logic,
    get_all_edges_logic,
)
from ..utils.graph_utils import get_networkx_graph_from_db_data

from ..services.performance_service import run_performance_test

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define APIRouter instances
nlp_router = APIRouter(prefix="/nlp", tags=["NLP Core"])
analysis_router = APIRouter(prefix="/analysis", tags=["Text Analysis"])
graph_router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])
performance_router = APIRouter(prefix="/performance", tags=["Performance Testing"])


@nlp_router.get("/health", response_model=dict)
async def health_check(nlp: Any = Depends(get_nlp_model)):
    """
    Health check endpoint.
    Returns the service status and the loaded spaCy model name.
    This endpoint is crucial for monitoring the service's availability
    and ensuring the NLP model is correctly loaded and ready for use.
    """
    if nlp:
        return {"status": "healthy", "model": nlp.meta.get("name", "Unknown")}
    # If the spaCy model is not loaded, return a 503 Service Unavailable status.
    else:
        raise HTTPException(status_code=503, detail="SpaCy model not loaded.")


@nlp_router.post("/process_text", response_model=ProcessedText)
async def process_text(request_data: TextInput, nlp: Any = Depends(get_nlp_model)):
    """
    Processes input text using the loaded spaCy model to perform fundamental
    Natural Language Processing (NLP) tasks.
    """
    if not nlp:
        # Ensure the spaCy model is loaded before processing any text.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    return process_text_logic(nlp, request_data.text)


@graph_router.post("/extract_relationships", response_model=ExtractedRelationships)
async def extract_relationships(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Extracts simple subject-verb-object (SVO) relationships from the input text
    using spaCy's dependency parsing. This endpoint was implemented as part of
    "Knowledge Graph Foundation using spaCy extracted data" task.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )
    return await extract_relationships_logic(nlp, request_data.text, session=db)


@graph_router.post("/query_graph_neighbors", response_model=NeighborsResponse)
async def query_graph_neighbors(
    request_data: GraphQueryRequest,
    nlp: Any = Depends(get_nlp_model),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Queries the neighbors of a given node in the graph.
    For demonstration, the graph is reconstructed from a dummy set of relationships.
    In a production environment, the graph would be persisted and loaded efficiently.
    """
    logger.info(f"Querying neighbors for node_id: {request_data.node_id}")
    logger.info(f"Database session: {db}")
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    nodes_response = await get_all_nodes_logic(db, GraphFilterRequest())
    edges_response = await get_all_edges_logic(db, GraphFilterRequest())

    # Reconstruct the graph from database nodes and edges
    graph = get_networkx_graph_from_db_data(nodes_response.nodes, edges_response.edges)

    logger.info(f"Nodes from DB: {nodes_response.nodes}")
    logger.info(f"Edges from DB: {edges_response.edges}")
    logger.info(f"Reconstructed graph nodes: {graph.nodes}")
    logger.info(f"Reconstructed graph edges: {graph.edges}")

    try:
        return query_neighbors_logic(request_data.node_id, graph)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@graph_router.post("/query_shortest_path", response_model=PathResponse)
async def query_shortest_path(
    request_data: PathQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Finds the shortest path between two nodes in the graph.
    """
    nodes_response = await get_all_nodes_logic(db, GraphFilterRequest())
    edges_response = await get_all_edges_logic(db, GraphFilterRequest())

    graph = get_networkx_graph_from_db_data(nodes_response.nodes, edges_response.edges)

    try:
        return query_shortest_path_logic(
            request_data.source_node_id, request_data.target_node_id, graph
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@graph_router.get("/nodes", response_model=GraphNodesResponse)
async def get_nodes(
    filters: GraphFilterRequest = Depends(), db: AsyncSession = Depends(get_db_session)
):
    """
    Retrieve all nodes or filter by source_document_id and type.
    """
    return await get_all_nodes_logic(db, filters)


@graph_router.get("/edges", response_model=GraphEdgesResponse)
async def get_edges(
    filters: GraphFilterRequest = Depends(), db: AsyncSession = Depends(get_db_session)
):
    """
    Retrieve all edges or filter by source_document_id and relation_type.
    """
    return await get_all_edges_logic(db, filters)


@graph_router.post("/centrality", response_model=CentralityResponse)
async def get_centrality(db: AsyncSession = Depends(get_db_session)):
    """
    Calculate centrality measures for nodes.
    """
    nodes_response = await get_all_nodes_logic(db, GraphFilterRequest())
    edges_response = await get_all_edges_logic(db, GraphFilterRequest())

    graph = get_networkx_graph_from_db_data(nodes_response.nodes, edges_response.edges)
    return query_centrality_measures_logic(graph)


@graph_router.post("/communities", response_model=CommunityDetectionResponse)
async def get_communities(db: AsyncSession = Depends(get_db_session)):
    """
    Detect communities within the graph.
    """
    nodes_response = await get_all_nodes_logic(db, GraphFilterRequest())
    edges_response = await get_all_edges_logic(db, GraphFilterRequest())

    graph = get_networkx_graph_from_db_data(nodes_response.nodes, edges_response.edges)
    return query_community_detection_logic_louvain(graph)


@analysis_router.post("/analyze_swot", response_model=SWOTAnalysisResult)
async def analyze_swot(request_data: TextInput, nlp: Any = Depends(get_nlp_model)):
    """
    Performs a basic SWOT (Strengths, Weaknesses, Opportunities, Threats)
    analysis on the input text.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )
    return perform_swot_analysis(nlp, request_data.text)


@analysis_router.post(
    "/identify_leverage_points", response_model=LeveragePointsResponse
)
async def identify_leverage_points(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Identifies leverage points in the text by constructing a knowledge graph
    and calculating node centrality.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    extracted_relationships = await extract_relationships_logic(
        nlp, request_data.text, db
    )
    # Retrieves a NetworkX DiGraph object for centrality calculation.
    graph = get_networkx_graph_from_relationships(extracted_relationships.relationships)

    # Calculate degree centrality
    centrality = nx.degree_centrality(graph)

    # Sort nodes by centrality score in descending order
    sorted_centrality = sorted(centrality.items(), key=lambda item: item, reverse=True)
    # Identify top N leverage points (e.g., top 10)
    top_n = 10
    leverage_points = []
    for node_id, score in sorted_centrality[:top_n]:
        leverage_points.append(LeveragePoint(node_id=node_id, centrality_score=score))

    return LeveragePointsResponse(leverage_points=leverage_points)


@performance_router.post("/test_performance", response_model=PerformanceTestResult)
async def test_performance(
    request_data: PerformanceTestRequest, nlp: Any = Depends(get_nlp_model)
):
    """
    Tests the performance of the spaCy NLP model by processing a given text
    multiple times.

    It measures the total time taken to process the text for a specified
    number of iterations and calculates the average processing time per text.
    This is useful for benchmarking and identifying performance bottlenecks.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )
    try:
        return run_performance_test(nlp, request_data.text, request_data.num_iterations)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@graph_router.post(
    "/query_knowledge_graph_for_rag", response_model=KnowledgeGraphQueryResponse
)
async def query_knowledge_graph_for_rag(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Allows an external RAG system to query the knowledge graph for relevant context
    based on a given text query.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    doc = nlp(request_data.text)
    extracted_entities = [ent.text for ent in doc.ents]

    # Initialize lists for nodes and edges
    all_relevant_nodes = []
    all_relevant_edges = []

    # Query for nodes related to extracted entities
    for entity_text in extracted_entities:
        # For simplicity, we'll query nodes by label matching the entity text.
        # In a more advanced scenario, you might need to resolve entities to canonical IDs.
        nodes_response = await get_all_nodes_logic(
            db, GraphFilterRequest(node_type=None, source_document_id=None)
        )

        # Filter nodes by label matching the entity text
        relevant_nodes_for_entity = [
            node
            for node in nodes_response.nodes
            if node.label and entity_text.lower() in node.label.lower()
        ]
        all_relevant_nodes.extend(relevant_nodes_for_entity)

    # Query for edges related to the identified nodes
    # This part might need more sophisticated logic depending on how "relevant" edges are defined.
    # For now, we'll fetch all edges and filter them if their source or target is in our relevant nodes.
    edges_response = await get_all_edges_logic(
        db, GraphFilterRequest(relation_type=None, source_document_id=None)
    )

    relevant_node_ids = {node.id for node in all_relevant_nodes}

    relevant_edges = [
        edge
        for edge in edges_response.edges
        if edge.source in relevant_node_ids or edge.target in relevant_node_ids
    ]
    all_relevant_edges.extend(relevant_edges)

    # Remove duplicates from nodes and edges
    unique_nodes = {node.id: node for node in all_relevant_nodes}.values()
    unique_edges = {
        f"{edge.source}-{edge.target}-{edge.label}": edge for edge in all_relevant_edges
    }.values()

    return KnowledgeGraphQueryResponse(
        nodes=list(unique_nodes), edges=list(unique_edges)
    )

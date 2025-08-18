from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import networkx as nx

from ..models import (
    TextInput,
    SWOTAnalysisResult,
    ProcessedText,
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphEdge,
    KnowledgeGraph,
    GraphQueryRequest,
    PathQueryRequest,
    NeighborsResponse,
    PathResponse,
    LeveragePoint,
    LeveragePointsResponse,
    PerformanceTestRequest,
    PerformanceTestResult,
)

from ..api.dependencies import get_nlp_model
from ..core.processing import process_text_logic
from ..services.swot_service import perform_swot_analysis
from ..services.relationship_service import extract_relationships_logic
from ..services.graph_query_service import (
    query_neighbors_logic,
    query_path_logic,
)
from ..services.performance_service import run_performance_test

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


@graph_router.post("/extract_relationships", response_model=ExtractedRelationships)
async def extract_relationships(
    request_data: TextInput, nlp: Any = Depends(get_nlp_model)
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
    return extract_relationships_logic(nlp, request_data.text)


@graph_router.post("/query_graph_neighbors", response_model=NeighborsResponse)
async def query_graph_neighbors(
    request_data: GraphQueryRequest, nlp: Any = Depends(get_nlp_model)
):
    """
    Queries the neighbors of a given node in the graph.
    For demonstration, the graph is reconstructed from a dummy set of relationships.
    In a production environment, the graph would be persisted and loaded efficiently.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    # Dummy relationships for demonstration. In a real scenario, these would come from a persistent store.
    # For simplicity, we'll use a hardcoded set of relationships to build the graph.
    # In a more robust solution, we would load the graph from a database or a global in-memory object
    # populated by the /extract_relationships endpoint.
    dummy_relationships = [
        RelationshipTriple(subject="Apple", relation="produces", object="iPhone"),
        RelationshipTriple(subject="Apple", relation="produces", object="MacBook"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Windows"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Surface"),
        RelationshipTriple(subject="Google", relation="develops", object="Android"),
        RelationshipTriple(subject="Google", relation="owns", object="YouTube"),
        RelationshipTriple(subject="iPhone", relation="is_a", object="Smartphone"),
        RelationshipTriple(subject="MacBook", relation="is_a", object="Laptop"),
        RelationshipTriple(subject="Windows", relation="is_an", object="OS"),
    ]
    try:
        return query_neighbors_logic(request_data.node_id, dummy_relationships)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@graph_router.post("/query_graph_path", response_model=PathResponse)
async def query_graph_path(
    request_data: PathQueryRequest, nlp: Any = Depends(get_nlp_model)
):
    """
    Finds a path between two nodes in the graph.
    For demonstration, the graph is reconstructed from a dummy set of relationships.
    In a production environment, the graph would be persisted and loaded efficiently.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    # Dummy relationships for demonstration.
    dummy_relationships = [
        RelationshipTriple(subject="Apple", relation="produces", object="iPhone"),
        RelationshipTriple(subject="Apple", relation="produces", object="MacBook"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Windows"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Surface"),
        RelationshipTriple(subject="Google", relation="develops", object="Android"),
        RelationshipTriple(subject="Google", relation="owns", object="YouTube"),
        RelationshipTriple(subject="iPhone", relation="is_a", object="Smartphone"),
        RelationshipTriple(subject="MacBook", relation="is_a", object="Laptop"),
        RelationshipTriple(subject="Windows", relation="is_an", object="OS"),
    ]
    try:
        return query_path_logic(
            request_data.source_node_id,
            request_data.target_node_id,
            dummy_relationships,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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


@analysis_router.post(
    "/identify_leverage_points", response_model=LeveragePointsResponse
)
async def identify_leverage_points(
    request_data: TextInput, nlp: Any = Depends(get_nlp_model)
):
    """
    Identifies leverage points in the text by constructing a knowledge graph
    and calculating node centrality.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    extracted_relationships = extract_relationships_logic(nlp, request_data.text)
    # The graph conversion and centrality calculation should remain here as it's specific to this endpoint's logic
    # and not a generic graph query.
    graph = (
        extracted_relationships.graph.to_networkx()
    )  # Convert to NetworkX graph for centrality calculation

    # Calculate degree centrality
    centrality = nx.degree_centrality(graph)

    # Sort nodes by centrality score in descending order
    sorted_centrality = sorted(
        centrality.items(), key=lambda item: item, reverse=True
    )  # Corrected sort key

    # Identify top N leverage points (e.g., top 10)
    top_n = 10
    leverage_points = []
    for node_id, score in sorted_centrality[:top_n]:
        leverage_points.append(LeveragePoint(node_id=node_id, centrality_score=score))

    return LeveragePointsResponse(leverage_points=leverage_points)

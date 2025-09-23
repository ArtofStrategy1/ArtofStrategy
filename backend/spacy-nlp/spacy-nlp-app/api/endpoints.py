import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional

from ..database.neo4j_crud import Neo4jCRUD
from ..database.neo4j_models import Node, Relationship # Import Node and Relationship from neo4j_models for internal use
from ..api.dependencies import get_neo4j_crud

from ..models import (
    TextInput,
    SWOTAnalysisResult,
    ProcessedText,
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphRelationship,
    KnowledgeGraphQueryResponse,
    KnowledgeGraph, # This KnowledgeGraph is from models.py
    GraphQueryRequest,
    GraphProjectionRequest,
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
    GraphRelationshipsResponse,
)

from ..api.dependencies import get_nlp_model
from ..core.processing import process_text_logic
from ..services.swot_service import perform_swot_analysis
from ..services.relationship_service import (
    extract_relationships_logic,
)
from ..services.graph_query_service import (
    query_neighbors_logic,
    query_shortest_path_logic,
    query_centrality_measures_logic,
    query_community_detection_logic_louvain,
    query_community_detection_logic_girvan_newman,
    get_all_nodes_logic,
    get_all_relationships_logic,
    identify_leverage_points_logic,
)

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
async def process_text(request_data: TextInput, include_full_nlp_details: bool = False, nlp: Any = Depends(get_nlp_model)):
    """
    Processes input text using the loaded spaCy model to perform fundamental
    Natural Language Processing (NLP) tasks.
    """
    if not nlp:
        # Ensure the spaCy model is loaded before processing any text.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    return process_text_logic(nlp, request_data.text, include_full_nlp_details)


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


@analysis_router.post("/identify_leverage_points", response_model=LeveragePointsResponse)
async def identify_leverage_points(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud),
):
    """
    Identifies leverage points in the text by constructing a knowledge graph
    and calculating node centrality using Neo4j.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    # Extract relationships and persist to Neo4j
    await extract_relationships_logic(
        nlp, request_data.text, neo4j_crud
    )
    
    # Calculate centrality measures using Neo4j GDS
    centrality_response = await query_centrality_measures_logic(neo4j_crud, 'lev_p', ['ENTITY'], {'*': {'orientation': 'UNDIRECTED'}})

    # Identify leverage points based on centrality
    leverage_points_data = await identify_leverage_points_logic(neo4j_crud, centrality_response)
    
    leverage_points = []
    for node_id, data in leverage_points_data.get("leverage_points", {}).items():
        leverage_points.append(LeveragePoint(node_id=node_id, centrality_score=data["combined_score"]))

    return LeveragePointsResponse(leverage_points=leverage_points)

@graph_router.get("/knowledge-graph", response_model=KnowledgeGraph)
async def get_full_knowledge_graph(neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud)):
    # Retrieve nodes and relationships from Neo4j (these are database models)
    db_nodes: List[Node] = neo4j_crud.get_all_nodes()
    db_relationships: List[Relationship] = []
    for node in db_nodes:
        db_relationships.extend(neo4j_crud.get_relationships_for_node(node.id))
        
    # Deduplicate relationships if necessary
    unique_db_relationships = {rel.id: rel for rel in db_relationships}.values()

    # Convert database Node objects to API GraphNode objects
    api_nodes: List[GraphNode] = [
        GraphNode(
            id=node.id,
            label=node.label,
            properties=node.properties
        ) for node in db_nodes
    ]

    # Convert database Relationship objects to API GraphRelationship objects
    api_relationships: List[GraphRelationship] = [
        GraphRelationship(
            source_id=rel.source_id,
            target_id=rel.target_id,
            type=rel.type,
            properties=rel.properties
        ) for rel in unique_db_relationships
    ]

    # Return the KnowledgeGraph using API-facing models
    return KnowledgeGraph(nodes=api_nodes, relationships=api_relationships)

@graph_router.post("/extract_relationships", response_model=ExtractedRelationships)
async def extract_relationships(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud),
    min_confidence: float = 0.6, # New optional query parameter
):
    """
    Extracts simple subject-verb-object (SVO) relationships from the input text
    using spaCy's dependency parsing and persists them to Neo4j.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )
    return await extract_relationships_logic(nlp, request_data.text, neo4j_crud, min_confidence)


@graph_router.post("/query_graph_neighbors", response_model=NeighborsResponse)
async def query_graph_neighbors(
    request_data: GraphQueryRequest,
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud),
):
    """
    Queries the neighbors of a given node in the Neo4j graph.
    """
    logger.info(f"Querying neighbors for node_id: {request_data.node_id}")
    
    try:
        return query_neighbors_logic(request_data.node_id, neo4j_crud)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@graph_router.post("/query_shortest_path", response_model=PathResponse)
async def query_shortest_path(
    request_data: PathQueryRequest,
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud),
):
    """
    Finds the shortest path between two nodes in the Neo4j graph.
    """
    try:
        return query_shortest_path_logic(
            request_data.source_node_id, request_data.target_node_id, neo4j_crud
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@graph_router.get("/nodes", response_model=GraphNodesResponse)
async def get_nodes(
    filters: GraphFilterRequest = Depends(), neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud)
):
    """
    Retrieve all nodes or filter by source_document_id and type from Neo4j.
    """
    # get_all_nodes_logic already returns GraphNodesResponse
    return await get_all_nodes_logic(neo4j_crud, filters)


@graph_router.get("/relationships", response_model=GraphRelationshipsResponse)
async def get_relationships(
    filters: GraphFilterRequest = Depends(), neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud)
):
    """
    Retrieve all relationships or filter by source_document_id and relation_type from Neo4j.
    """
    # get_all_relationships_logic already returns GraphRelationshipsResponse
    return await get_all_relationships_logic(neo4j_crud, filters)


@graph_router.post("/centrality", response_model=CentralityResponse)
async def get_centrality(
    request_data: GraphProjectionRequest,
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud)
):
    """
    Calculate centrality measures for nodes using Neo4j, with configurable graph projection.
    """
    return await query_centrality_measures_logic(
        neo4j_crud,
        graph_name=request_data.graph_name,
        relationship_property_filter=request_data.relationship_property_filter
    )


@graph_router.post("/communities", response_model=CommunityDetectionResponse)
async def get_communities(
    request_data: GraphProjectionRequest,
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud)
):
    """
    Detect communities within the graph using Neo4j.
    """
    return await query_community_detection_logic_louvain(
        neo4j_crud,
        graph_name=request_data.graph_name,
        node_labels=request_data.node_labels,
        relationship_types=request_data.relationship_types
    )


@graph_router.post(
    "/query_knowledge_graph_for_rag", response_model=KnowledgeGraphQueryResponse
)
async def query_knowledge_graph_for_rag(
    request_data: TextInput,
    nlp: Any = Depends(get_nlp_model),
    neo4j_crud: Neo4jCRUD = Depends(get_neo4j_crud),
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

    # Query for nodes related to extracted entities using the updated logic
    nodes_response = await get_all_nodes_logic(
        neo4j_crud, GraphFilterRequest(), entity_texts=extracted_entities
    )
    all_relevant_nodes = nodes_response.nodes

    # Extract node IDs from the relevant nodes to query for relationships
    relevant_node_ids = [node.id for node in all_relevant_nodes]

    # Query for relationships related to the identified nodes using the updated logic
    relationships_response = await get_all_relationships_logic(
        neo4j_crud, GraphFilterRequest(), node_ids=relevant_node_ids
    )
    all_relevant_relationships = relationships_response.relationships

    # Remove duplicates (though the database queries should already handle much of this)
    unique_nodes = {node.id: node for node in all_relevant_nodes}.values()
    unique_relationships = {
        f"{relationship.source_id}-{relationship.type}-{relationship.target_id}": relationship for relationship in all_relevant_relationships
    }.values()

    return KnowledgeGraphQueryResponse(
        nodes=list(unique_nodes), relationships=list(unique_relationships)
    )


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

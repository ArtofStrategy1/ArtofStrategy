import logging
from fastapi import HTTPException
from typing import List, Dict, Optional, Any
from collections import defaultdict

from ..database.neo4j_crud import Neo4jCRUD
from ..database.neo4j_models import Node, Relationship, KnowledgeGraph
from ..models import (
    RelationshipTriple,
    NeighborsResponse,
    PathResponse,
    CentralityResponse,
    CommunityDetectionResponse,
    GraphNode,
    GraphEdge,
    GraphFilterRequest,
    GraphNodesResponse,
    GraphEdgesResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_all_nodes_logic(
    neo4j_crud: Neo4jCRUD,
    filters: GraphFilterRequest,
    entity_texts: Optional[List[str]] = None,
) -> GraphNodesResponse:
    """
    Retrieves all nodes from the Neo4j database, with optional filtering by source_document_id, node_type, or entity_texts.
    """
    logger.info(f"Executing get_all_nodes_logic with filters: {filters}, entities: {entity_texts}")

    # Fetch all nodes first, then apply Python-side filtering for simplicity
    # For large graphs, this should be optimized with Cypher queries in neo4j_crud
    all_neo4j_nodes = neo4j_crud.get_all_nodes(label=filters.node_type)

    filtered_nodes = []
    for node in all_neo4j_nodes:
        match = True
        if filters.source_document_id and node.properties.get("source_document_id") != filters.source_document_id:
            match = False
        if entity_texts:
            node_text = node.properties.get("name", "").lower()
            if not any(et.lower() in node_text for et in entity_texts):
                match = False
        
        if match:
            filtered_nodes.append(
                GraphNode(
                    id=node.id,
                    label=node.properties.get("name", node.label),
                    type=node.label, # Using Neo4j label as type
                    source_document_id=node.properties.get("source_document_id"),
                    properties=node.properties,
                )
            )
    return GraphNodesResponse(nodes=filtered_nodes)


async def get_all_edges_logic(
    neo4j_crud: Neo4jCRUD,
    filters: GraphFilterRequest,
    node_ids: Optional[List[str]] = None,
) -> GraphEdgesResponse:
    """
    Retrieves all edges (relationships) from the Neo4j database, with optional filtering by source_document_id, relation_type, or connected node_ids.
    """
    logger.info(f"Executing get_all_edges_logic with filters: {filters}, node_ids: {node_ids}")

    # Fetch all relationships. This needs a new method in Neo4jCRUD or a direct Cypher query.
    # For now, we'll fetch relationships for each node_id if provided, or all relationships if not.
    all_neo4j_relationships: List[Relationship] = []
    if node_ids:
        for node_id in node_ids:
            all_neo4j_relationships.extend(neo4j_crud.get_relationships_for_node(node_id))
        # Remove duplicates if a relationship is fetched multiple times
        unique_relationships = {rel.id: rel for rel in all_neo4j_relationships}.values()
        all_neo4j_relationships = list(unique_relationships)
    else:
        # This requires a new method in Neo4jCRUD to get all relationships
        # For now, we'll simulate by getting all nodes and then their relationships
        all_nodes = neo4j_crud.get_all_nodes()
        for node in all_nodes:
            all_neo4j_relationships.extend(neo4j_crud.get_relationships_for_node(node.id))
        unique_relationships = {rel.id: rel for rel in all_neo4j_relationships}.values()
        all_neo4j_relationships = list(unique_relationships)


    filtered_edges = []
    for rel in all_neo4j_relationships:
        match = True
        if filters.source_document_id and rel.properties.get("source_document_id") != filters.source_document_id:
            match = False
        if filters.relation_type and rel.type != filters.relation_type:
            match = False
        
        if match:
            filtered_edges.append(
                GraphEdge(
                    source_id=rel.source_id,
                    target_id=rel.target_id,
                    type=rel.type,
                    properties={
                        "label": rel.type,
                        "relation_type": rel.type,
                        "source_document_id": rel.properties.get("source_document_id"),
                        **rel.properties
                    },
                )
            )
    return GraphEdgesResponse(edges=filtered_edges)


def query_neighbors_logic(node_id: str, neo4j_crud: Neo4jCRUD) -> NeighborsResponse:
    """
    Queries the neighbors of a given node in the Neo4j graph.
    """
    logger.info(f"Querying neighbors for node_id: {node_id} in query_neighbors_logic")
    
    # This needs a specific Cypher query in neo4j_crud to get neighbors
    # For now, we'll implement a basic version here
    query = """
    MATCH (n {id: $node_id})-[r]-(m)
    RETURN m.id AS neighbor_id
    """
    parameters = {"node_id": node_id}
    results = neo4j_crud._execute_query(query, parameters) # Accessing protected method for now, should be public in CRUD

    neighbors = [record["neighbor_id"] for record in results]
    if not neighbors and not neo4j_crud.get_node(node_id):
        raise HTTPException(
            status_code=404, detail=f"Node '{node_id}' not found in graph."
        )
    return NeighborsResponse(neighbors=neighbors)


def query_shortest_path_logic(
    source_node_id: str, target_node_id: str, neo4j_crud: Neo4jCRUD
) -> PathResponse:
    """
    Finds the shortest path between two nodes in the Neo4j graph.
    """
    query = """
    MATCH (source {id: $source_node_id}), (target {id: $target_node_id})
    CALL gds.shortestPath.dijkstra.stream('knowledge_graph', {
        sourceNode: gds.util.asNode(source),
        targetNode: gds.util.asNode(target),
        relationshipWeightProperty: 'weight' // Assuming relationships have a 'weight' property
    })
    YIELD index, sourceNode, targetNode, totalCost, nodeIds, path
    RETURN
        [nodeId IN nodeIds | gds.util.asNode(nodeId).id] AS node_ids_in_path,
        totalCost
    """
    parameters = {"source_node_id": source_node_id, "target_node_id": target_node_id}
    results = neo4j_crud._execute_query(query, parameters)

    if results:
        path_nodes = results[0]["node_ids_in_path"] # Corrected line
        return PathResponse(path=path_nodes)
    
    # Check if nodes exist
    if not neo4j_crud.get_node(source_node_id):
        raise HTTPException(status_code=404, detail=f"Source node '{source_node_id}' not found.")
    if not neo4j_crud.get_node(target_node_id):
        raise HTTPException(status_code=404, detail=f"Target node '{target_node_id}' not found.")

    return PathResponse(path=[]) # No path found


def query_centrality_measures_logic(
    neo4j_crud: Neo4jCRUD,
) -> CentralityResponse:
    """
    Calculates various centrality measures for the Neo4j graph using the Graph Data Science (GDS) library.
    """
    # Project the graph into GDS in-memory graph
    project_query = """
    CALL gds.graph.project(
        'knowledge_graph',
        ['ENTITY'], // Node labels to include
        {
            TEMPORAL: {
                orientation: 'UNDIRECTED' // Or 'NATURAL' if direction matters for centrality
            }
        }
    )
    """
    neo4j_crud._execute_query(project_query)
    logger.info(f"Executing GDS project_query: {project_query}")

    degree_c_query = """
    CALL gds.degree.stream('knowledge_graph')
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    degree_results = neo4j_crud._execute_query(degree_c_query)
    degree_centrality = {record["node_id"]: record["score"] for record in degree_results}

    betweenness_c_query = """
    CALL gds.betweenness.stream('knowledge_graph')
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    betweenness_results = neo4j_crud._execute_query(betweenness_c_query)
    betweenness_centrality = {record["node_id"]: record["score"] for record in betweenness_results}

    eigenvector_c_query = """
    CALL gds.eigenvector.stream('knowledge_graph')
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    eigenvector_results = neo4j_crud._execute_query(eigenvector_c_query)
    eigenvector_centrality = {record["node_id"]: record["score"] for record in eigenvector_results}

    return CentralityResponse(
        degree_centrality=degree_centrality,
        betweenness_centrality=betweenness_centrality,
        eigenvector_centrality=eigenvector_centrality,
    )


def query_community_detection_logic_louvain(
    neo4j_crud: Neo4jCRUD,
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Louvain method with Neo4j's Graph Data Science (GDS) library.
    """
    # Project the graph into GDS in-memory graph (if not already projected)
    project_query = """
    CALL gds.graph.project(
        'knowledge_graph',
        ['ENTITY'],
        {
            RELATIONSHIP: {
                orientation: 'UNDIRECTED'
            }
        }
    )
    """
    neo4j_crud._execute_query(project_query)

    louvain_query = """
    CALL gds.louvain.stream('knowledge_graph')
    YIELD nodeId, communityId
    RETURN gds.util.asNode(nodeId).id AS node_id, communityId
    """
    results = neo4j_crud._execute_query(louvain_query)

    communities_dict = defaultdict(list)
    for record in results:
        communities_dict[record["communityId"]].append(record["node_id"])

    communities = [list(nodes) for nodes in communities_dict.values()]
    return CommunityDetectionResponse(communities=communities)


def query_community_detection_logic_girvan_newman(
    neo4j_crud: Neo4jCRUD,
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Girvan-Newman algorithm with Neo4j's Graph Data Science (GDS) library.
    """
    # Project the graph into GDS in-memory graph (if not already projected)
    project_query = """
    CALL gds.graph.project(
        'knowledge_graph',
        ['ENTITY'],
        {
            RELATIONSHIP: {
                orientation: 'UNDIRECTED'
            }
        }
    )
    """
    neo4j_crud._execute_query(project_query)


    girvan_newman_query = """
    CALL gds.beta.community.girvanNewman.stream('knowledge_graph')
    YIELD communityId, nodeIds
    RETURN communityId, [nodeId IN nodeIds | gds.util.asNode(nodeId).id] AS node_ids
    """
    results = neo4j_crud._execute_query(girvan_newman_query)

    communities = []
    for record in results:
        communities.append(record["node_ids"])
    
    return CommunityDetectionResponse(communities=communities)

def identify_leverage_points_logic(
    neo4j_crud: Neo4jCRUD,
    centrality_response: CentralityResponse,
    top_n: int = 5,
) -> Dict[str, Any]:
    """
    Identifies potential leverage points in the graph based on centrality measures.
    Leverage points are nodes that have a disproportionately high influence or control
    over the flow of information or resources in the network.
    """
    if not centrality_response.degree_centrality:
        return {"message": "No centrality data available to identify leverage points."}

    # Combine centrality scores for a more comprehensive view
    # For simplicity, we'll sum normalized scores. More complex weighting can be applied.
    combined_scores = defaultdict(float)
    all_nodes = set(centrality_response.degree_centrality.keys()) \
                .union(centrality_response.betweenness_centrality.keys()) \
                .union(centrality_response.eigenvector_centrality.keys())

    for node_id in all_nodes:
        degree = centrality_response.degree_centrality.get(node_id, 0)
        betweenness = centrality_response.betweenness_centrality.get(node_id, 0)
        eigenvector = centrality_response.eigenvector_centrality.get(node_id, 0)
        
        # Simple sum for combined score. Normalization might be needed for different scales.
        combined_scores[node_id] = degree + betweenness + eigenvector

    # Sort nodes by combined score in descending order
    sorted_leverage_points = sorted(
        combined_scores.items(), key=lambda item: item, reverse=True
    )

    # Return the top N leverage points
    top_leverage_points = {
        node_id: {"combined_score": score}
        for node_id, score in sorted_leverage_points[:top_n]
    }

    return {"leverage_points": top_leverage_points}

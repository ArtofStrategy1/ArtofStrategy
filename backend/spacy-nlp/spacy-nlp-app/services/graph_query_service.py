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

# sourceNode: gds.util.asNode(source),
# targetNode: gds.util.asNode(target),
# relationshipWeightProperty: 'weight' // Assuming relationships have a 'weight' property
def query_shortest_path_logic(
    source_node_id: str, target_node_id: str, neo4j_crud: Neo4jCRUD
) -> PathResponse:
    """
    Finds the shortest path between two nodes in the Neo4j graph.
    """
    query = """
    MATCH (source {id: $source_node_id}), (target {id: $target_node_id})
    CALL gds.shortestPath.dijkstra.stream('knowledge_graph', {
        sourceNode: source,
        targetNode: target
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


async def query_centrality_measures_logic(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    node_labels: List[str],
    relationship_types: Dict[str, Dict[str, str]]
) -> CentralityResponse:
    """
    Calculates various centrality measures for the Neo4j graph using the Graph Data Science (GDS) library.
    """
    # Call the helper function to project the graph
    project_gds_graph(
        neo4j_crud=neo4j_crud,
        graph_name=graph_name,
        node_labels=node_labels,
        relationship_types=relationship_types
    )

    parameters = {
            "graphName": graph_name,
    }

    degree_c_query = """
    CALL gds.degree.stream($graphName)
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    degree_results = neo4j_crud._execute_query(degree_c_query, parameters)
    degree_centrality = {record["node_id"]: record["score"] for record in degree_results}

    betweenness_c_query = """
    CALL gds.betweenness.stream($graphName)
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    betweenness_results = neo4j_crud._execute_query(betweenness_c_query, parameters)
    betweenness_centrality = {record["node_id"]: record["score"] for record in betweenness_results}

    eigenvector_c_query = """
    CALL gds.eigenvector.stream($graphName)
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    eigenvector_results = neo4j_crud._execute_query(eigenvector_c_query, parameters)
    eigenvector_centrality = {record["node_id"]: record["score"] for record in eigenvector_results}

    return CentralityResponse(
        degree_centrality=degree_centrality,
        betweenness_centrality=betweenness_centrality,
        eigenvector_centrality=eigenvector_centrality,
    )


async def query_community_detection_logic_louvain(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    node_labels: List[str],
    relationship_types: Dict[str, Dict[str, str]]
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Louvain method with Neo4j's Graph Data Science (GDS) library.
    """
    # Call the helper function to project the graph
    project_gds_graph(
        neo4j_crud=neo4j_crud,
        graph_name=graph_name,
        node_labels=node_labels,
        relationship_types=relationship_types
    )

    parameters = {
            "graphName": graph_name,
    }

    louvain_query = """
    CALL gds.louvain.stream($graphName)
    YIELD nodeId, communityId
    RETURN gds.util.asNode(nodeId).id AS node_id, communityId
    """
    results = neo4j_crud._execute_query(louvain_query, parameters)

    communities_dict = defaultdict(list)
    for record in results:
        communities_dict[record["communityId"]].append(record["node_id"])

    communities = [list(nodes) for nodes in communities_dict.values()]
    return CommunityDetectionResponse(communities=communities)


async def query_community_detection_logic_girvan_newman(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    node_labels: List[str],
    relationship_types: Dict[str, Dict[str, str]]
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Girvan-Newman algorithm with Neo4j's Graph Data Science (GDS) library.
    """
    # Call the helper function to project the graph
    project_gds_graph(
        neo4j_crud=neo4j_crud,
        graph_name=graph_name,
        node_labels=node_labels,
        relationship_types=relationship_types
    )

    parameters = {
            "graphName": graph_name,
    }

    girvan_newman_query = """
    CALL gds.beta.community.girvanNewman.stream($graphName)
    YIELD communityId, nodeIds
    RETURN communityId, [nodeId IN nodeIds | gds.util.asNode(nodeId).id] AS node_ids
    """
    results = neo4j_crud._execute_query(girvan_newman_query, parameters)

    communities = []
    for record in results:
        communities.append(record["node_ids"])
    
    return CommunityDetectionResponse(communities=communities)

async def identify_leverage_points_logic(
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



def project_gds_graph(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    node_labels: List[str],
    relationship_types: Dict[str, Dict[str, str]]
):
    """
    Projects a graph into Neo4j's Graph Data Science (GDS) in-memory graph
    with configurable node labels and relationship types.
    """
    # Input validation
    if not graph_name or not node_labels:
        raise ValueError("Graph name and node labels are required")
    
    # Validate node labels (basic sanitization)
    validated_labels = []
    for label in node_labels:
        if not isinstance(label, str) or not label.isidentifier():
            raise ValueError(f"Invalid node label: {label}")
        validated_labels.append(label)
    
    # Validate and construct relationship types
    validated_rel_types = {}
    for rel_type, props in relationship_types.items():
        if not isinstance(rel_type, str) or not rel_type:
            raise ValueError(f"Invalid relationship type: {rel_type}")
        
        if not isinstance(props, dict):
            raise ValueError(f"Relationship properties must be a dict for {rel_type}")
        
        # Validate property values are strings
        validated_props = {}
        for key, value in props.items():
            if not isinstance(key, str) or not isinstance(value, str):
                raise ValueError(f"Property key and value must be strings: {key}={value}")
            validated_props[key] = value
        
        validated_rel_types[rel_type] = validated_props

    try:
        # Use parameterized query where possible
        # Note: GDS projection requires literal values, so we still need some string construction
        # but we validate inputs first
        project_query = """
        CALL gds.graph.project($graphName, $nodeLabels, $relationshipTypes)
        """
        
        parameters = {
            "graphName": graph_name,
            "nodeLabels": validated_labels,
            "relationshipTypes": validated_rel_types
        }
        
        result = neo4j_crud._execute_query(project_query, parameters)
        
        logger.info(
            f"GDS graph '{graph_name}' projected successfully with "
            f"{len(validated_labels)} node labels and "
            f"{len(validated_rel_types)} relationship types"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to project GDS graph '{graph_name}': {str(e)}")
        raise

    

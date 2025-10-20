import logging
from fastapi import HTTPException
from typing import List, Dict, Optional, Any
from collections import defaultdict
from neo4j import Record

from ..database.neo4j_crud import Neo4jCRUD
from ..database.neo4j_models import Node, Relationship, KnowledgeGraph
from ..models import (
    RelationshipTriple,
    NeighborsResponse,
    PathResponse,
    CentralityResponse,
    CommunityDetectionResponse,
    GraphNode,
    GraphRelationship,
    GraphFilterRequest,
    GraphNodesResponse,
    GraphRelationshipsResponse,
    KnowledgeGraphQueryResponse
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

    # Fetch all nodes first, then apply Python-side filtering for simplicity.
    # For large graphs, this will be optimized with Cypher queries in neo4j_crud.
    all_neo4j_nodes = neo4j_crud.get_all_nodes(label=filters.node_label)

    filtered_nodes = []
    for node in all_neo4j_nodes:
        match = True
        if filters.source_document_id and node.properties.get("source_document_id") != filters.source_document_id:
            match = False
        if entity_texts:
            node_text = node.properties.get("id").lower()
            if not any(et.lower() in node_text for et in entity_texts):
                match = False
        
        if match:
            filtered_nodes.append(
                GraphNode(
                    id=node.id,
                    label=node.label,
                    source_document_id=node.properties.get("source_document_id"),
                    properties=node.properties
                )
            )
    return GraphNodesResponse(nodes=filtered_nodes)


async def get_all_relationships_logic(
    neo4j_crud: Neo4jCRUD,
    filters: GraphFilterRequest,
    node_ids: Optional[List[str]] = None
) -> GraphRelationshipsResponse:
    """
    Retrieves all relationships from the Neo4j database, with optional filtering by source_document_id, relation_type, or connected node_ids.
    """
    logger.info(f"Executing get_all_relationships_logic with filters: {filters}, node_ids: {node_ids}")

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


    filtered_relationships = []
    for rel in all_neo4j_relationships:
        match = True
        if filters.source_document_id and rel.properties.get("source_document_id") != filters.source_document_id:
            match = False
        if filters.relation_type and rel.properties.get("relation_type") != filters.relation_type:
            match = False
        
        if match:
            filtered_relationships.append(
                GraphRelationship(
                    source_id=rel.source_id,
                    target_id=rel.target_id,
                    type=rel.type,
                    properties={
                        "relation_type": rel.properties.get("relation_type"),
                        "source_document_id": rel.properties.get("source_document_id"),
                        **rel.properties
                    }
                )
            )
    return GraphRelationshipsResponse(relationships=filtered_relationships)


def query_neighbors_logic(node_id: str, neo4j_crud: Neo4jCRUD) -> NeighborsResponse:
    """
    Queries the neighbors of a given node in the Neo4j graph.
    """
    logger.info(f"Querying neighbors for node_id: {node_id}.")
    
    # This needs a specific Cypher query in neo4j_crud to get neighbors
    # For now, we'll implement a basic version here
    query = """
    MATCH (n {id: $node_id, user_id: $user_id})-[r]-(m)
    WHERE r.user_id = $user_id AND b.user_id = $user_id
    RETURN m.id AS neighbor_id
    """
    parameters = {"node_id": node_id, "user_id": neo4j_crud._user_id}
    results = neo4j_crud._execute_query(query, parameters) # Accessing protected method for now, should be public in CRUD

    neighbors = [record["neighbor_id"] for record in results]
    if not neighbors and not neo4j_crud.get_node(node_id):
        raise HTTPException(
            status_code=404, detail=f"Node '{node_id}' not found in graph'."
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
    MATCH (source {id: $source_node_id, user_id: $user_id}), 
    (target {id: $target_node_id, user_id: $user_id})
    CALL gds.shortestPath.dijkstra.stream('knowledge_graph', {
        sourceNode: source,
        targetNode: target
    })
    YIELD index, sourceNode, targetNode, totalCost, nodeIds, path
    RETURN
        [nodeId IN nodeIds | gds.util.asNode(nodeId).id] AS node_ids_in_path,
        totalCost
    """
    parameters = {"source_node_id": source_node_id, "target_node_id": target_node_id, 
                  "user_id": neo4j_crud._user_id}
    results = neo4j_crud._execute_query(query, parameters)

    if results:
        path_nodes = results[0]["node_ids_in_path"] # Corrected line
        return PathResponse(path=path_nodes)
    
    # Check if nodes exist
    if not neo4j_crud.get_node(source_node_id):
        raise HTTPException(status_code=404, detail=f"Source node '{source_node_id}'.")
    if not neo4j_crud.get_node(target_node_id):
        raise HTTPException(status_code=404, detail=f"Target node '{target_node_id}'.")

    return PathResponse(path=[]) # No path found


async def query_centrality_measures_logic(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    relation_type: str
    # relationship_property_filter: Dict[str, str]
) -> CentralityResponse:
    """
    Calculates various centrality measures for the Neo4j graph using the Graph Data Science (GDS) library.
    """
    # Call the helper function to project the graph
    project_gds_graph(
        neo4j_crud=neo4j_crud,
        graph_name=graph_name,
        relation_type=relation_type
    )

    parameters = {
            "graphName": graph_name,
    }

    # logger.info(f"Graph Name: {graph_name}")
    # logger.info(f"Node Labels: {node_labels}")
    # logger.info(f"Rel Types: {relationship_types}")
    
    degree_c_query = """
    CALL gds.degree.stream($graphName)
    YIELD nodeId, score
    RETURN gds.util.asNode(nodeId).id AS node_id, score
    """
    degree_results = neo4j_crud._execute_query(degree_c_query, parameters)
    degree_centrality = {record["node_id"]: record["score"] for record in degree_results}

    # logger.info(f"Degree Results: {degree_results}")

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
        eigenvector_centrality=eigenvector_centrality
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
        relationship_types=relationship_types,
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
    relationship_types: Dict[str, Dict[str, str]],
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Girvan-Newman algorithm with Neo4j's 
    Graph Data Science (GDS) library.
    """
    # Call the helper function to project the graph
    project_gds_graph(
        neo4j_crud=neo4j_crud,
        graph_name=graph_name,
        node_labels=node_labels,
        relationship_types=relationship_types,
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


async def query_knowledge_graph_for_rag(
    neo4j_crud: Neo4jCRUD,
    nlp: Any,
    text: str,
) -> KnowledgeGraphQueryResponse:
    """
    Allows an external RAG system to query the knowledge graph for relevant context
    based on a given text query using hybrid search (full-text + graph traversal).
    """
    # 1. Use full-text search to get initial seed nodes
    logger.info(f"Performing full-text search for query: {text}.")
    fulltext_results = neo4j_crud.search_nodes_fulltext(text, limit=5)

    seed_node_ids = []
    all_relevant_nodes: Dict[str, GraphNode] = {}
    all_relevant_relationships: Dict[str, GraphRelationship] = {}

    for result in fulltext_results:
        node_properties = result["node_properties"]
        node_id = node_properties.get("id")
        if node_id:
            seed_node_ids.append(node_id)
            # Convert Neo4j node properties to GraphNode model
            all_relevant_nodes[node_id] = GraphNode(
                id=node_id,
                label=node_properties.get("label", "ENTITY"), # Assuming 'label' property exists or default
                properties=node_properties
            )

    # 2. Expand from seed nodes to get their neighbors and relationships
    for node_id in seed_node_ids:
        # Get the node itself (if not already added from full-text search)
        if node_id not in all_relevant_nodes:
            db_node = neo4j_crud.get_node(node_id)
            if db_node:
                all_relevant_nodes[db_node.id] = GraphNode(
                    id=db_node.id,
                    label=db_node.label,
                    properties=db_node.properties
                )

        # Get relationships for the current seed node.
        db_relationships = neo4j_crud.get_relationships_for_node(node_id)
        for rel in db_relationships:
            rel_key = f"{rel.source_id}-{rel.type}-{rel.target_id}"
            if rel_key not in all_relevant_relationships:
                all_relevant_relationships[rel_key] = GraphRelationship(
                    source_id=rel.source_id,
                    target_id=rel.target_id,
                    type=rel.type,
                    properties=rel.properties
                )
            
            # Also add the connected neighbor node if not already in all_relevant_nodes
            # Source node of relationship
            if rel.source_id not in all_relevant_nodes:
                source_db_node = neo4j_crud.get_node(rel.source_id)
                if source_db_node:
                    all_relevant_nodes[source_db_node.id] = GraphNode(
                        id=source_db_node.id,
                        label=source_db_node.label,
                        properties=source_db_node.properties
                    )

            # Target node of relationship
            if rel.target_id not in all_relevant_nodes:
                target_db_node = neo4j_crud.get_node(rel.target_id)
                if target_db_node:
                    all_relevant_nodes[target_db_node.id] = GraphNode(
                        id=target_db_node.id,
                        label=target_db_node.label,
                        properties=target_db_node.properties
                    )

    return KnowledgeGraphQueryResponse(
        nodes=list(all_relevant_nodes.values()),
        relationships=list(all_relevant_relationships.values())
    )


def project_gds_graph(
    neo4j_crud: Neo4jCRUD,
    graph_name: str,
    relation_type: str,
) -> list[Record]:
    """
    Projects a graph into Neo4j's Graph Data Science (GDS) in-memory graph
    using a Cypher Projection for relationships with the given relation_type, 
    filtered by user_id.
    Nodes and relationships are projected with all their labels and properties.
    """
    if not graph_name:
        raise ValueError("Graph name is required for GDS projection.")
    
    if not relation_type:
        raise ValueError("Relation type is required for GDS projection.")

    try:
        # Drop any existing graph projection with the same name before creating a new one
        # to ensure a clean state and avoid conflicts.
        drop_query = f"CALL gds.graph.drop('{graph_name}', false) YIELD graphName;"
        neo4j_crud._execute_query(drop_query, {})
        logger.info(f"Dropping existing GDS graph '{graph_name}'.")
    except Exception as e:
        logger.warning(f"Could not drop GDS graph '{graph_name}' (might not exist or be in use): {e}")

    try:
        # Parameters for the gds.graph.project call
        parameters = {
            "graphName": graph_name,
            "relationType": relation_type,
            "user_id": neo4j_crud._user_id
        }
        
        # Projection query using the proper gds.graph.project syntax.
        # The gds.graph.project function is used as an aggregation function with `WITH`.
        project_cypher_query = """
        MATCH (a)-[r]-(b)
        WHERE r.relation_type = $relationType 
        AND a.user_id = $user_id 
        AND r.user_id = $user_id
        AND b.user_id = $user_id
        WITH gds.graph.project(
            $graphName,
            a,  // sourceNode as Node object
            b,  // targetNode as Node object
            {
                sourceNodeLabels: labels(a),
                targetNodeLabels: labels(b),
                relationshipType: type(r)
            }
        ) AS g
        RETURN g.graphName AS projectedGraphName, g.nodeCount AS nodeCount, 
        g.relationshipCount AS relationshipCount
        """

        result = neo4j_crud._execute_query(project_cypher_query, parameters)
        
        logger.info(f"GDS graph '{graph_name}' projected successfully for relation type '{relation_type}'.")

        return result
        
    except Exception as e:
        logger.error(f"Failed to project GDS graph '{graph_name}' for relation type '{relation_type}': \
                     {str(e)}")
        raise

import logging
import networkx as nx
import community as co
from fastapi import HTTPException
from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from itertools import combinations
from collections import defaultdict
from itertools import chain
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
from ..database.models import KGNode, KGEdge
from ..database.crud import get_kg_node_by_id, get_kg_edge_by_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_all_nodes_logic(
    session: AsyncSession,
    filters: GraphFilterRequest,
    entity_texts: Optional[List[str]] = None,
) -> GraphNodesResponse:
    logger.info(f"Executing get_all_nodes_logic with filters: {filters}, entities: {entity_texts}")
    logger.info(f"Database session in get_all_nodes_logic: {session}")
    """
    Retrieves all nodes from the database, with optional filtering by source_document_id, node_type, or entity_texts.
    """
    query = select(KGNode)
    if filters.source_document_id:
        query = query.where(KGNode.source_document_id == filters.source_document_id)
    if filters.node_type:
        query = query.where(KGNode.type == filters.node_type)
    if entity_texts:
        # Filter by entity_text or label containing any of the provided entity_texts
        entity_conditions = []
        for entity_text in entity_texts:
            entity_conditions.append(KGNode.entity_text.ilike(f"%{entity_text}%"))
            entity_conditions.append(KGNode.label.ilike(f"%{entity_text}%"))
        if entity_conditions:
            query = query.where(or_(*entity_conditions))

    result = await session.execute(query)
    kg_nodes = result.scalars().all()

    logger.info(f"Raw KGNodes fetched: {kg_nodes}")

    nodes = [
        GraphNode(
            id=str(node.node_id),
            label=node.label if node.label else node.entity_text,
            type=node.type,
            source_document_id=node.source_document_id,
            properties=node.properties,
        )
        for node in kg_nodes
    ]
    return GraphNodesResponse(nodes=nodes)


async def get_all_edges_logic(
    session: AsyncSession,
    filters: GraphFilterRequest,
    node_ids: Optional[List[str]] = None,
) -> GraphEdgesResponse:
    logger.info(f"Executing get_all_edges_logic with filters: {filters}, node_ids: {node_ids}")
    logger.info(f"Database session in get_all_edges_logic: {session}")
    """
    Retrieves all edges from the database, with optional filtering by source_document_id, relation_type, or connected node_ids.
    """
    query = select(KGEdge)
    if filters.source_document_id:
        query = query.where(KGEdge.source_document_id == filters.source_document_id)
    if filters.relation_type:
        query = query.where(KGEdge.relation_type == filters.relation_type)
    if node_ids:
        # Filter edges where either source_node_id or target_node_id is in the provided list
        node_id_conditions = or_(
            KGEdge.source_node_id.in_(node_ids),
            KGEdge.target_node_id.in_(node_ids)
        )
        query = query.where(node_id_conditions)

    result = await session.execute(query)
    kg_edges = result.scalars().all()

    logger.info(f"Raw KGEdges fetched: {kg_edges}")

    edges = []
    for edge in kg_edges:
        source_node = await get_kg_node_by_id(session, edge.source_node_id)
        target_node = await get_kg_node_by_id(session, edge.target_node_id)
        if source_node and target_node:
            edges.append(
                GraphEdge(
                    source=str(source_node.node_id),
                    target=str(target_node.node_id),
                    label=edge.relation_type,
                    relation_type=edge.relation_type,
                    source_document_id=edge.source_document_id,
                )
            )
    return GraphEdgesResponse(edges=edges)


def query_neighbors_logic(node_id: str, graph: nx.DiGraph) -> NeighborsResponse:
    """
    Queries the neighbors of a given node in the graph.
    """
    logger.info(f"Querying neighbors for node_id: {node_id} in query_neighbors_logic")
    logger.info(f"Graph nodes: {graph.nodes}")
    logger.info(f"Graph edges: {graph.edges}")
    if node_id not in graph:
        raise HTTPException(
            status_code=404, detail=f"Node '{node_id}' not found in graph."
        )
    neighbors = list(graph.neighbors(node_id))
    return NeighborsResponse(neighbors=neighbors)


def query_shortest_path_logic(
    source_node_id: str, target_node_id: str, graph: nx.DiGraph
) -> PathResponse:
    """
    Finds the shortest path between two nodes in the graph.

    Args:
        source_node_id (str): The ID of the source node.
        target_node_id (str): The ID of the target node.
        graph (nx.DiGraph): The NetworkX graph.

    Returns:
        PathResponse: A Pydantic model containing the shortest path as a list of node IDs.
                      Returns an empty list if no path exists or nodes are not found.
    """
    if source_node_id not in graph:
        raise HTTPException(
            status_code=404,
            detail=f"Source node '{source_node_id}' not found in graph.",
        )
    if target_node_id not in graph:
        raise HTTPException(
            status_code=404,
            detail=f"Target node '{target_node_id}' not found in graph.",
        )

    try:
        path = nx.shortest_path(graph, source=source_node_id, target=target_node_id)
        return PathResponse(path=path)
    except nx.NetworkXNoPath:
        return PathResponse(path=[])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while finding the shortest path: {e}",
        )


def query_centrality_measures_logic(
    graph: nx.DiGraph,
) -> CentralityResponse:
    """
    Calculates various centrality measures for the graph.

    Args:
        graph (nx.DiGraph): The NetworkX graph.

    Returns:
        CentralityResponse: A Pydantic model containing dictionaries of degree,
                            betweenness, and eigenvector centrality scores.
    """
    if not graph.nodes():
        return CentralityResponse(
            degree_centrality={}, betweenness_centrality={}, eigenvector_centrality={}
        )

    try:
        degree_c = nx.degree_centrality(graph)
        betweenness_c = nx.betweenness_centrality(graph)
        eigenvector_c = nx.eigenvector_centrality(graph, max_iter=1000)
        return CentralityResponse(
            degree_centrality=degree_c,
            betweenness_centrality=betweenness_c,
            eigenvector_centrality=eigenvector_c,
        )
    except nx.NetworkXException as e:
        raise HTTPException(
            status_code=500, detail=f"NetworkX error during centrality calculation: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during centrality calculation: {e}",
        )


def query_community_detection_logic_louvain(
    graph: nx.DiGraph,
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Louvain method.

    Args:
        graph (nx.DiGraph): The NetworkX graph.

    Returns:
        CommunityDetectionResponse: A Pydantic model containing the detected communities.
    """
    if not graph.nodes():
        return CommunityDetectionResponse(communities=[])

    try:
        # The Louvain method works best on undirected graphs
        undirected_graph = graph.to_undirected()
        partition = co.best_partition(undirected_graph)

        communities_dict = defaultdict(list)
        for node, community_id in partition.items():
            communities_dict[community_id].append(node)

        communities = [list(nodes) for nodes in communities_dict.values()]
        return CommunityDetectionResponse(communities=communities)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during Louvain community detection: {e}",
        )


def query_community_detection_logic_girvan_newman(
    graph: nx.DiGraph,
) -> CommunityDetectionResponse:
    """
    Performs community detection using the Girvan-Newman algorithm.

    Args:
        graph (nx.DiGraph): The NetworkX graph.

    Returns:
        CommunityDetectionResponse: A Pydantic model containing the detected communities.
    """
    if not graph.nodes():
        return CommunityDetectionResponse(communities=[])

    try:
        # The Girvan-Newman algorithm works best on undirected graphs
        undirected_graph = graph.to_undirected()
        # The Girvan-Newman algorithm returns an iterator of communities at each step
        # We take the communities from the last step (most refined partition)
        comp = nx.community.girvan_newman(undirected_graph)

        # Iterate through the generator to get the final communities
        # This might need adjustment based on desired number of communities or modularity
        communities_generator = tuple(sorted(c) for c in next(comp))

        communities = [list(c) for c in communities_generator]
        return CommunityDetectionResponse(communities=communities)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during Girvan-Newman community detection: {e}",
        )

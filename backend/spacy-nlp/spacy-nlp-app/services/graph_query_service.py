import networkx as nx
from fastapi import HTTPException
from typing import List
from ..models import RelationshipTriple, NeighborsResponse, PathResponse


def _build_graph_from_relationships(
    relationships: List[RelationshipTriple],
) -> nx.DiGraph:
    """
    Helper function to build a NetworkX graph from a list of RelationshipTriple objects.
    """
    graph = nx.DiGraph()
    for triple in relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)
    return graph


def query_neighbors_logic(
    node_id: str, relationships: List[RelationshipTriple]
) -> NeighborsResponse:
    """
    Queries the neighbors of a given node in the graph.
    """
    graph = _build_graph_from_relationships(relationships)

    if node_id not in graph:
        # In a real application, this might raise an HTTPException, but here we return an empty list
        # or handle it as per the service's error handling policy.
        raise HTTPException(
            status_code=404, detail=f"Node '{node_id}' not found in graph."
        )
        return NeighborsResponse(neighbors=[])

    neighbors = list(graph.neighbors(node_id))
    return NeighborsResponse(neighbors=neighbors)


def query_path_logic(
    source_node_id: str, target_node_id: str, relationships: List[RelationshipTriple]
) -> PathResponse:
    """
    Finds a path between two nodes in the graph.
    """
    graph = _build_graph_from_relationships(relationships)

    if source_node_id not in graph or target_node_id not in graph:
        # In a real application, this might raise an HTTPException.
        return PathResponse(path=[])

    try:
        path = nx.shortest_path(graph, source=source_node_id, target=target_node_id)
        return PathResponse(path=path)
    except nx.NetworkXNoPath:
        return PathResponse(path=[])

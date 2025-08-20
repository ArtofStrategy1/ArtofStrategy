import networkx as nx
from typing import List
from ..models import GraphNode, GraphEdge


def find_lca(ent1_root, ent2_root):
    """
    Finds the lowest common ancestor (LCA) of two spaCy tokens in the dependency tree.
    """
    lca = None
    for ancestor in ent1_root.ancestors:
        if ancestor.is_ancestor(ent2_root):
            lca = ancestor
            break
    if lca is None:
        for ancestor in ent2_root.ancestors:
            if ancestor.is_ancestor(ent1_root):
                lca = ancestor
                break
    if lca is None:
        if ent1_root.is_ancestor(ent2_root):
            lca = ent1_root
        elif ent2_root.is_ancestor(ent1_root):
            lca = ent2_root
        else:
            lca = ent1_root
    return lca


def get_networkx_graph_from_db_data(
    nodes: List[GraphNode], edges: List[GraphEdge]
) -> nx.DiGraph:
    """
    Constructs a NetworkX DiGraph from a list of GraphNode and GraphEdge objects.
    """
    graph = nx.DiGraph()

    for node in nodes:
        graph.add_node(
            node.id, label=node.label, type=node.type, properties=node.properties
        )

    for edge in edges:
        graph.add_edge(
            edge.source, edge.target, relation=edge.label, properties=edge.properties
        )

    return graph

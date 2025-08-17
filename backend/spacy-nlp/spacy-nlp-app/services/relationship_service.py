import networkx as nx
from typing import List, Dict, Any, Optional
from ..models import (
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphEdge,
    KnowledgeGraph,
)
import logging
from ..utils.graph_utils import find_lca

logger = logging.getLogger(__name__)


def extract_relationships_logic(nlp, text: str) -> ExtractedRelationships:
    """
    Extracts simple subject-verb-object (SVO) relationships from the input text
    using spaCy's dependency parsing.

    It iterates through sentences, identifies the root verb, and then attempts
    to find a nominal subject (`nsubj`) and a direct object (`dobj`) to form
    a relationship triple. This forms a foundational step for building knowledge graphs.
    """
    doc = nlp(text)
    relationships = []

    for sent in doc.sents:
        # Iterate through entities in the sentence to find relationships between them.
        # This approach focuses on finding a verb or preposition that connects two entities.
        for ent1 in sent.ents:
            for ent2 in sent.ents:
                if ent1 != ent2:
                    # Find the shortest path between two entities in the dependency tree.
                    # This path can reveal the nature of their relationship.
                    try:
                        # Get the lowest common ancestor (LCA) of the two entities.
                        # The LCA is often a verb or a preposition that defines the relationship.
                        # Initialize LCA.
                        lca = find_lca(ent1.root, ent2.root)

                        # If the LCA is a verb or a preposition, it likely represents the relation.
                        if lca and lca.pos_ in ["VERB", "AUX", "ADP"]:
                            # Extract the subject and object based on the entities and their relation to the LCA.
                            subject = ent1.text
                            relation = lca.lemma_
                            obj = ent2.text
                            relationships.append(
                                RelationshipTriple(
                                    subject=subject, relation=relation, object=obj
                                )
                            )
                        # Consider relationships where one entity is a child of the other's root,
                        # and the root itself is a verb or preposition.
                        elif (
                            ent1.root.head == ent2.root.head
                            and ent1.root.head.pos_ in ["VERB", "AUX", "ADP"]
                        ):
                            relationships.append(
                                RelationshipTriple(
                                    subject=ent1.text,
                                    relation=ent1.root.head.lemma_,
                                    object=ent2.text,
                                )
                            )
                    except Exception as e:
                        logger.warning(
                            f"Could not determine relationship between '{ent1.text}' and '{ent2.text}': {e}"
                        )

        # Retain the original SVO extraction for simpler sentences where entities might not be directly linked.
        root = None
        for token in sent:
            if token.dep_ == "ROOT":
                root = token
                break

        if root:
            subject = None
            obj = None

            # Find the nominal subject (nsubj) of the root verb.
            for child in root.children:
                if child.dep_ == "nsubj":
                    subject = child
                    break

            # Find the direct object (dobj) of the root verb.
            for child in root.children:
                if child.dep_ == "dobj":
                    obj = child
                    break

            # If both a subject and an object are found, form a relationship triple.
            if subject and obj:
                relationships.append(
                    RelationshipTriple(
                        subject=subject.text, relation=root.lemma_, object=obj.text
                    )
                )

    knowledge_graph = build_knowledge_graph(relationships)
    # Return the extracted relationship triples and the knowledge graph.
    return ExtractedRelationships(relationships=relationships, graph=knowledge_graph)


def build_knowledge_graph(relationships: List[RelationshipTriple]) -> KnowledgeGraph:
    """
    Builds an in-memory NetworkX KnowledgeGraph from a list of RelationshipTriple objects.
    """
    graph = nx.DiGraph()
    for triple in relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)

    # Convert NetworkX graph nodes to GraphNode objects
    graph_nodes = []
    for node_id in graph.nodes():
        # For now, using the node_id as both id and label.
        # More sophisticated logic could extract type or additional properties if available.
        graph_nodes.append(GraphNode(id=node_id, label=node_id))

    # Convert NetworkX graph edges to GraphEdge objects
    graph_edges = []
    for source, target, data in graph.edges(data=True):
        relation_label = data.get("relation", "unknown")
        graph_edges.append(
            GraphEdge(source=source, target=target, label=relation_label)
        )

    # Create a KnowledgeGraph instance
    return KnowledgeGraph(nodes=graph_nodes, edges=graph_edges)

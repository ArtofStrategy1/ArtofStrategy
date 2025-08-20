import networkx as nx
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import (
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphEdge,
    KnowledgeGraph,
)
import logging
from ..utils.graph_utils import find_lca
from ..database.crud import get_kg_edge_by_nodes_and_type
from ..database.crud import create_kg_node, create_kg_edge, get_kg_node_by_text_and_type

logger = logging.getLogger(__name__)


def get_networkx_graph_from_relationships(
    relationships: List[RelationshipTriple],
) -> nx.DiGraph:
    """
    Builds a NetworkX DiGraph from a list of RelationshipTriple objects.
    """
    graph = nx.DiGraph()
    for triple in relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)
    return graph


async def extract_relationships_logic(
    nlp,
    text: str,
    session: AsyncSession,
    source_document_id: Optional[str] = None,
    source_sentence_id: Optional[str] = None,
) -> ExtractedRelationships:
    """
    Extracts simple subject-verb-object (SVO) relationships from the input text
    using spaCy's dependency parsing and persists them to the database.

    It iterates through sentences, identifies the root verb, and then attempts
    to find a nominal subject (`nsubj`) and a direct object (`dobj`) to form
    a relationship triple. This forms a foundational step for building knowledge graphs.
    """
    doc = nlp(text)
    relationships = []
    persisted_nodes = {}  # Cache for already persisted nodes to avoid duplicates

    async def get_or_create_node(entity_text: str, entity_type: str) -> int:
        node_key = (entity_text, entity_type)
        if node_key in persisted_nodes:
            return persisted_nodes[node_key].node_id

        node = await get_kg_node_by_text_and_type(session, entity_text, entity_type)
        if not node:
            node = await create_kg_node(
                session,
                entity_text=entity_text,
                type=entity_type,
                label=entity_text,
                source_document_id=source_document_id,
            )
        persisted_nodes[node_key] = node
        return node.node_id

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
                            subject_text = ent1.text
                            relation_text = lca.lemma_
                            object_text = ent2.text

                            subject_node_id = await get_or_create_node(
                                subject_text, ent1.label_
                            )
                            object_node_id = await get_or_create_node(
                                object_text, ent2.label_
                            )

                            existing_edge = await get_kg_edge_by_nodes_and_type(
                                session, subject_node_id, object_node_id, relation_text
                            )
                            if not existing_edge:
                                await create_kg_edge(
                                    session,
                                    source_node_id=subject_node_id,
                                    target_node_id=object_node_id,
                                    relation_type=relation_text,
                                    source_document_id=source_document_id,
                                    source_sentence_id=source_sentence_id,
                                )
                            else:
                                logger.info(
                                    f"Skipping duplicate edge: ({subject_text}, {relation_text}, {object_text})"
                                )
                            relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
                                )
                            )
                        # Consider relationships where one entity is a child of the other's root,
                        # and the root itself is a verb or preposition.
                        elif (
                            ent1.root.head == ent2.root.head
                            and ent1.root.head.pos_ in ["VERB", "AUX", "ADP"]
                        ):
                            subject_text = ent1.text
                            relation_text = ent1.root.head.lemma_
                            object_text = ent2.text

                            subject_node_id = await get_or_create_node(
                                subject_text, ent1.label_
                            )
                            object_node_id = await get_or_create_node(
                                object_text, ent2.label_
                            )

                            existing_edge = await get_kg_edge_by_nodes_and_type(
                                session, subject_node_id, object_node_id, relation_text
                            )
                            if not existing_edge:
                                await create_kg_edge(
                                    session,
                                    source_node_id=subject_node_id,
                                    target_node_id=object_node_id,
                                    relation_type=relation_text,
                                    source_document_id=source_document_id,
                                    source_sentence_id=source_sentence_id,
                                )
                            else:
                                logger.info(
                                    f"Skipping duplicate edge: ({subject_text}, {relation_text}, {object_text})"
                                )
                            relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
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
            subject_token = None
            object_token = None

            # Find the nominal subject (nsubj) of the root verb.
            for child in root.children:
                if child.dep_ == "nsubj":
                    subject_token = child
                    break

            # Find the direct object (dobj) of the root verb.
            for child in root.children:
                if child.dep_ == "dobj":
                    object_token = child
                    break

            # If both a subject and an object are found, form a relationship triple.
            if subject_token and object_token:
                subject_text = subject_token.text
                relation_text = root.lemma_
                object_text = object_token.text

                # For SVO, we might not have entity types directly from spaCy's `ent.label_`.
                # A common approach is to use "NOUN" or "PROPN" as a default type,
                # or infer from context/NER if available. For simplicity, let's use "ENTITY" for now.
                subject_type = (
                    subject_token.pos_
                    if subject_token.pos_ in ["NOUN", "PROPN"]
                    else "ENTITY"
                )
                object_type = (
                    object_token.pos_
                    if object_token.pos_ in ["NOUN", "PROPN"]
                    else "ENTITY"
                )

                subject_node_id = await get_or_create_node(subject_text, subject_type)
                object_node_id = await get_or_create_node(object_text, object_type)

                existing_edge = await get_kg_edge_by_nodes_and_type(
                    session, subject_node_id, object_node_id, relation_text
                )
                if not existing_edge:
                    await create_kg_edge(
                        session,
                        source_node_id=subject_node_id,
                        target_node_id=object_node_id,
                        relation_type=relation_text,
                        source_document_id=source_document_id,
                        source_sentence_id=source_sentence_id,
                    )
                else:
                    logger.info(
                        f"Skipping duplicate edge: ({subject_text}, {relation_text}, {object_text})"
                    )
                relationships.append(
                    RelationshipTriple(
                        subject=subject_text, relation=relation_text, object=object_text
                    )
                )

    knowledge_graph = build_knowledge_graph(relationships)
    # Return the extracted relationship triples and the knowledge graph.
    return ExtractedRelationships(relationships=relationships, graph=knowledge_graph)


def build_knowledge_graph(relationships: List[RelationshipTriple]) -> KnowledgeGraph:
    """
    Builds an in-memory NetworkX KnowledgeGraph from a list of RelationshipTriple objects.
    This function now primarily serves to construct the in-memory graph for immediate
    return, as persistence is handled within extract_relationships_logic.
    """
    graph = get_networkx_graph_from_relationships(relationships)

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

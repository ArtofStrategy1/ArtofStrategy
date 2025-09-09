import spacy
from spacy.matcher import Matcher
from typing import List, Dict, Any, Optional
import logging

from ..database.neo4j_crud import Neo4jCRUD
from ..database.neo4j_models import Node, Relationship
from ..models import (
    RelationshipTriple,
    ExtractedRelationships,
    KnowledgeGraph, # Import KnowledgeGraph from models.py
    GraphNode,      # Import GraphNode from models.py
    GraphEdge,      # Import GraphEdge from models.py
)
from ..utils.graph_utils import find_lca

logger = logging.getLogger(__name__)


def resolve_coreferences(doc: spacy.tokens.Doc) -> spacy.tokens.Doc:
    """
    Applies coreference resolution to the doc object using fastcoref.
    It iterates through coreference clusters and updates entity spans
    to reflect the resolved coreferences.
    """
    if not hasattr(doc._, "fastcoref_clusters"):
        logger.warning("fastcoref pipeline component not found in spaCy model.")
        return doc

    # Create a mapping from coreferenced spans to their main mentions
    coref_map = {}
    for cluster in doc._.fastcoref_clusters:
        # The first mention in the cluster is typically the main mention
        main_mention_span = cluster # Access the first span in the cluster
        main_mention_text = doc[main_mention_span:main_mention_span].text # Extract text from the span

        for mention_span in cluster:
            # Only map if it's not the main mention itself
            if mention_span != main_mention_span:
                coref_map[mention_span] = main_mention_text # Use the start index of the mention span as the key

    # Reconstruct entities with resolved coreferences
    new_ents = []
    for ent in doc.ents:
        if ent.start in coref_map:
            # Create a new span for the resolved entity
            new_ents.append(
                spacy.tokens.Span(doc, ent.start, ent.end, label=ent.label,
                                  vector=ent.vector, vector_norm=ent.vector_norm,
                                  text=coref_map[ent.start])
            )
        else:
            new_ents.append(ent)
    doc.ents = spacy.tokens.Span.set_ents(doc, new_ents)
    return doc

async def extract_enhanced_relationships(
    doc: spacy.tokens.Doc,
    neo4j_crud: Neo4jCRUD,
    source_document_id: Optional[str] = None,
    source_sentence_id: Optional[str] = None,
) -> List[RelationshipTriple]:
    """
    Defines and applies custom spaCy Matcher patterns for enhanced relationship extraction.
    """
    relationships = []
    matcher = Matcher(doc.vocab)

    # Causal Relationship Pattern: [CAUSE] because [EFFECT] or [EFFECT] due to [CAUSE]
    # Pattern 1: Subject --verb--> object (causal verb)
    causal_pattern_1 = [
        {"DEP": "nsubj", "OP": "+"},
        {"LEMMA": {"IN": ["cause", "lead", "result", "trigger", "effect", "impact"]}, "POS": "VERB"},
        {"DEP": "dobj", "OP": "+"},
    ]
    matcher.add("CAUSAL_VERB", [causal_pattern_1])

    # Pattern 2: Noun phrase -- "due to" / "because of" --> Noun phrase
    causal_pattern_2 = [
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"},
        {"LOWER": {"IN": ["because", "due"]}, "POS": "ADP"},
        {"LOWER": "of", "OP": "?"},
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"},
    ]
    matcher.add("CAUSAL_PREPOSITION", [causal_pattern_2])

    # Temporal Relationship Pattern: [EVENT1] before/after [EVENT2]
    temporal_pattern = [
        {"POS": {"IN": ["NOUN", "PROPN", "VERB"]}, "OP": "+"},
        {"LOWER": {"IN": ["before", "after", "during", "when", "while"]}, "POS": {"IN": ["ADP", "SCONJ"]}},
        {"POS": {"IN": ["NOUN", "PROPN", "VERB"]}, "OP": "+"},
    ]
    matcher.add("TEMPORAL", [temporal_pattern])

    # Hierarchical Relationship Pattern: [ENTITY] is a type of [CATEGORY]
    hierarchical_pattern = [
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"},
        {"LEMMA": "be"},
        {"POS": "DET", "OP": "?"},
        {"LOWER": "type", "OP": "?"},
        {"LOWER": "of", "OP": "?"},
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"},
    ]
    matcher.add("HIERARCHICAL", [hierarchical_pattern])

    matches = matcher(doc)

    for match_id, start, end in matches:
        span = doc[start:end]
        rule_id = doc.vocab.strings[match_id]
        subject_text = ""
        object_text = ""
        relation_text = ""
        relation_type = ""
        confidence = 0.8 # Assign a default confidence

        if rule_id == "CAUSAL_VERB":
            # Example: "Rain causes floods"
            # Subject: Rain, Relation: causes, Object: floods
            subject_span = [token for token in span if token.dep_ == "nsubj"]
            object_span = [token for token in span if token.dep_ == "dobj"]
            verb_span = [token for token in span if token.pos_ == "VERB"]

            if subject_span and object_span and verb_span:
                subject_text = " ".join([token.text for token in subject_span])
                relation_text = verb_span.lemma_ if verb_span else ""
                object_text = " ".join([token.text for token in object_span])
                relation_type = "CAUSAL"

        elif rule_id == "CAUSAL_PREPOSITION":
            # Example: "Floods due to rain"
            # Subject: Floods, Relation: due to, Object: rain
            # This pattern is more complex to extract subject/object directly from dependency.
            # For simplicity, we'll take the first and last noun phrases.
            noun_phrases = [chunk.text for chunk in span.noun_chunks]
            if len(noun_phrases) >= 2:
                subject_text = " ".join(noun_phrases[:-1]) # Join all but the last as subject
                object_text = noun_phrases[-1]
                relation_text = "due to"
                relation_type = "CAUSAL"

        elif rule_id == "TEMPORAL":
            # Example: "He ate before he slept"
            # Subject: He (ate), Relation: before, Object: he (slept)
            # This requires more sophisticated entity linking. For now,
            # we'll extract the main verbs/nouns around the temporal connector.
            tokens = [token for token in span if token.pos_ in ["NOUN", "PROPN", "VERB"]]
            if len(tokens) >= 2:
                subject_text = " ".join([token.text for token in tokens[:-1]]) # Join all but the last as subject
                object_text = tokens[-1].text # Take the last token as object
                relation_text = " ".join([token.text for token in span if token.lower_ in ["before", "after", "during", "when", "while"]])
                relation_type = "TEMPORAL"

        elif rule_id == "HIERARCHICAL":
            # Example: "Apple is a type of fruit"
            # Subject: Apple, Relation: is a type of, Object: fruit
            noun_phrases = [chunk.text for chunk in span.noun_chunks]
            if len(noun_phrases) >= 2:
                subject_text = " ".join(noun_phrases[:-1]) # Join all but the last as subject
                object_text = noun_phrases[-1]
                relation_text = "is a type of"
                relation_type = "HIERARCHICAL"

        if subject_text and object_text and relation_text:
            relationships.append(
                RelationshipTriple(
                    subject=subject_text,
                    relation=relation_text,
                    object=object_text,
                    relation_type=relation_type,
                    confidence=confidence,
                    relation_metadata={"pattern_id": rule_id}
                )
            )
    return relationships


async def extract_relationships_logic(
    nlp,
    text: str,
    neo4j_crud: Neo4jCRUD,
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
    doc = resolve_coreferences(doc)
    all_extracted_relationships = []
    persisted_nodes: Dict[str, Node] = {}  # Cache for already persisted nodes to avoid duplicates

    async def get_or_create_node(entity_text: str, entity_type: str) -> Node:
        node_key = f"{entity_text}-{entity_type}"
        if node_key in persisted_nodes:
            return persisted_nodes[node_key]

        # Try to get the node from Neo4j first
        existing_node = neo4j_crud.get_node(node_id=entity_text, label=entity_type)
        if existing_node:
            persisted_nodes[node_key] = existing_node
            return existing_node

        # If not found, create a new node
        new_node = Node(
            id=entity_text,
            label=entity_type,
            properties={
                "name": entity_text,
                "source_document_id": source_document_id,
                "source_sentence_id": source_sentence_id,
            },
        )
        created_node = neo4j_crud.create_node(new_node)
        persisted_nodes[node_key] = created_node
        return created_node

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

                            all_extracted_relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
                                    relation_type="LCA_DEPENDENCY", # Default type for LCA
                                    confidence=0.7, # Default confidence
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

                            all_extracted_relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
                                    relation_type="HEAD_DEPENDENCY", # Default type for Head Dependency
                                    confidence=0.6, # Default confidence
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

                all_extracted_relationships.append(
                    RelationshipTriple(
                        subject=subject_text,
                        relation=relation_text,
                        object=object_text,
                        relation_type="SVO", # Default type for SVO
                        confidence=0.5, # Default confidence
                    )
                )

    # Extract enhanced relationships
    enhanced_relationships = await extract_enhanced_relationships(
        doc, neo4j_crud, source_document_id, source_sentence_id
    )
    all_extracted_relationships.extend(enhanced_relationships)

    # Deduplication Logic
    unique_relationships = set()
    deduplicated_relationships = []

    for rel in all_extracted_relationships:
        # Create a canonical representation for deduplication
        # Using a tuple of (subject, relation, object, relation_type) for exact duplicates
        canonical_representation = (
            rel.subject.lower(),
            rel.relation.lower(),
            rel.object.lower(),
            rel.relation_type.lower() if rel.relation_type else ""
        )
        if canonical_representation not in unique_relationships:
            unique_relationships.add(canonical_representation)
            deduplicated_relationships.append(rel)
        else:
            logger.info(f"Skipping duplicate relationship: ({rel.subject}, {rel.relation}, {rel.object})")

    # Persistence Update: Persist only deduplicated relationships
    for rel in deduplicated_relationships:
        subject_node = await get_or_create_node(rel.subject, "ENTITY") # Assuming ENTITY type for now
        object_node = await get_or_create_node(rel.object, "ENTITY") # Assuming ENTITY type for now

        # Prepare properties for Neo4j, flattening relation_metadata
        neo4j_properties = {
            "confidence": rel.confidence,
            "source_document_id": source_document_id,
            "source_sentence_id": source_sentence_id,
        }
        if rel.relation_metadata:
            neo4j_properties.update(rel.relation_metadata) # Flatten relation_metadata

        neo4j_crud.create_relationship(
            Relationship(
                source_id=subject_node.id,
                target_id=object_node.id,
                type=rel.relation_type,
                properties=neo4j_properties, # Pass the flattened properties
            )
        )

    knowledge_graph = build_knowledge_graph(deduplicated_relationships)
    # Return the extracted relationship triples and the knowledge graph.
    return ExtractedRelationships(relationships=deduplicated_relationships, graph=knowledge_graph)


def build_knowledge_graph(relationships: List[RelationshipTriple]) -> KnowledgeGraph:
    """
    Builds a KnowledgeGraph object from a list of RelationshipTriple objects.
    This function constructs the in-memory graph for immediate return,
    using the API-facing models from ..models.
    """
    nodes_map: Dict[str, GraphNode] = {}
    api_relationships: List[GraphEdge] = []

    for triple in relationships:
        # Create or retrieve subject GraphNode
        if triple.subject not in nodes_map:
            nodes_map[triple.subject] = GraphNode(id=triple.subject, label="ENTITY", properties={"name": triple.subject})
        
        # Create or retrieve object GraphNode
        if triple.object not in nodes_map:
            nodes_map[triple.object] = GraphNode(id=triple.object, label="ENTITY", properties={"name": triple.object})
        
        # Create relationship
        api_relationships.append(
            GraphEdge(
                source_id=triple.subject,
                target_id=triple.object,
                type=triple.relation_type,
                properties={
                    "confidence": triple.confidence,
                    "relation_metadata": triple.relation_metadata,
                },
            )
        )
    
    return KnowledgeGraph(nodes=list(nodes_map.values()), relationships=api_relationships)

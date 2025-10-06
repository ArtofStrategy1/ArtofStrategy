from spacy.tokens import Doc, Span, Token
from spacy.matcher import Matcher
from typing import List, Dict, Any, Optional
import logging

from ..database.neo4j_crud import Neo4jCRUD
from ..database.neo4j_models import Node, Relationship
from ..models import (
    RelationshipTriple,
    ExtractedRelationships,
    KnowledgeGraph,
    GraphNode,
    GraphRelationship,
    NamedEntity,
)
from ..utils.graph_utils import find_lca
from ..core.processing import extract_meaningful_entities
from ..core.processing import clean_text

logger = logging.getLogger(__name__)

# Constants for relationship types and entity labels
REL_TYPE_CAUSAL = "CAUSAL"
REL_TYPE_STRUCTURAL = "STRUCTURAL"
REL_TYPE_HIERARCHICAL = "HIERARCHICAL"
REL_TYPE_TEMPORAL = "TEMPORAL"
REL_TYPE_LCA_DEPENDENCY = "LCA_DEPENDENCY"
REL_TYPE_HEAD_DEPENDENCY = "HEAD_DEPENDENCY"
REL_TYPE_SVO = "SVO"

ENTITY_LABEL_DEFAULT = "ENTITY"

WEAK_VERBS = {"be", "have", "do", "say", "get", "make", "go", "know", "take", "see", 
              "come", "think", "look", "want", "give", "use", "find", "tell", "ask", 
              "work", "seem", "feel", "try", "leave", "call"}

STRONG_ENTITY_LABELS = {
    "ORG", "PERSON", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW",
    "LANGUAGE", "DATE", "TIME", "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"
}


async def get_or_create_node(
        neo4j_crud: Neo4jCRUD,
        entity_text: str, 
        entity_type: str, 
        persisted_nodes: Dict[str, Node],
        source_document_id: Optional[str] = None,
        source_sentence_id: Optional[str] = None,
) -> Node:
        """
        Helper function to get an existing node from Neo4j or create a new one if it doesn't exist.
        Caches nodes to prevent redundant database calls within a single processing session.
        """
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


async def persist_relationship_to_neo4j(
        neo4j_crud: Neo4jCRUD, 
        relationship: RelationshipTriple, 
        persisted_nodes: Dict[str, Node], 
        source_document_id: Optional[str], 
        source_sentence_id: Optional[str]
) -> None:
    """
    Handles the creation of nodes and relationships in Neo4j for a single RelationshipTriple.
    """
    # Persistence Update: Persist only deduplicated relationships to Neo4j
    # Get or create subject and object nodes in Neo4j
    subject_node = await get_or_create_node(
        neo4j_crud, 
        relationship.subject, 
        relationship.subject_label or ENTITY_LABEL_DEFAULT,
        persisted_nodes, 
        source_document_id, 
        source_sentence_id
    ) 

    object_node = await get_or_create_node(
        neo4j_crud, 
        relationship.object, 
        relationship.object_label or ENTITY_LABEL_DEFAULT,
        persisted_nodes, 
        source_document_id, 
        source_sentence_id
    ) 

    # Prepare properties for Neo4j, flattening relation_metadata
    neo4j_properties = {
        "relation_type": relationship.relation_type,
        "confidence": relationship.confidence,
        "source_document_id": source_document_id,
        "source_sentence_id": source_sentence_id,
    }
    if relationship.relation_metadata:
        # Flatten relation_metadata into node properties
        neo4j_properties.update(relationship.relation_metadata) 

    # Create the relationship in Neo4j
    neo4j_crud.create_relationship(
        Relationship(
            source_id=subject_node.id,
            source_label=subject_node.label,
            target_id=object_node.id,
            target_label=object_node.label,
            type=relationship.relation,
            properties=neo4j_properties, # Pass the flattened properties
        )
    )


def is_strong_named_entity(entity: NamedEntity) -> bool:
    """
    Checks if an entity's label is considered "strong" for relationship extraction.
    """
    return entity.label in STRONG_ENTITY_LABELS


def is_valid_entity_pair_in_sentence(
        ent1: NamedEntity, 
        ent2: NamedEntity, 
        sentence_span: Span
) -> bool:
    """
    Checks if two entities are distinct and fall within the bounds of a given sentence.
    """
    return (
        ent1.text != ent2.text and
        sentence_span.start_char <= ent1.start_char < sentence_span.end_char and
        sentence_span.start_char <= ent2.start_char < sentence_span.end_char
    )


def is_weak_verb(lemma: str) -> bool:
    """
    Checks if a given lemma is in the predefined set of weak verbs.
    """
    return lemma in WEAK_VERBS


def get_entity_from_span(span: Span, meaningful_entities: List[NamedEntity]) -> Optional[tuple[str,str]]:
    """
    Attempts to find a meaningful entity that matches or is contained within the given spaCy span.
    Prioritizes exact matches, then contained entities. This helps in linking extracted
    relationship components (subjects, objects) to the refined list of meaningful entities.

    Args:
        span (Span): The spaCy span to check for entity presence.
        meaningful_entities (List[NamedEntity]): The pre-extracted list of meaningful entities.

    Returns:
        Optional[str]: The text of the matched meaningful entity, or None if no suitable entity is found.
    """
    logger.info(f"Span: {type(span)}")

    span_text_lower = span.text.lower()
    
    # Prioritize exact matches with specific NER labels
    for entity in meaningful_entities:
        if entity.text.lower() == span_text_lower and entity.label != "NOUN_CHUNK":
            return (entity.text, entity.label)

    # Fallback to exact matches including NOUN_CHUNK
    for entity in meaningful_entities:
        if entity.text.lower() == span_text_lower:
            return (entity.text, entity.label)

    # Check for contained entities, prioritizing specific NER labels
    # This handles cases where the span is larger than the actual entity
    best_match = None
    for entity in meaningful_entities:
        if (entity.start_char >= span.start_char and entity.end_char <= span.end_char) or \
           (span.start_char >= entity.start_char and span.end_char <= entity.end_char):
            if not best_match or (entity.label != "NOUN_CHUNK" and best_match.label == "NOUN_CHUNK"):
                best_match = entity
            elif entity.label != "NOUN_CHUNK" and best_match.label != "NOUN_CHUNK" and \
                 len(entity.text) > len(best_match.text): # Prefer longer NER matches
                best_match = entity
            elif entity.label == "NOUN_CHUNK" and best_match.label == "NOUN_CHUNK" and \
                 len(entity.text) > len(best_match.text): # Prefer longer NOUN_CHUNK matches
                best_match = entity

    if best_match:
        return (best_match.text, best_match.label)

    return "", ""


def classify_svo_relationship(triple: RelationshipTriple, doc: Doc) -> RelationshipTriple:
    """
    Classifies a generic SVO relationship into more specific types (CAUSAL, TEMPORAL, HIERARCHICAL, STRUCTURAL)
    based on the verb and surrounding context.
    """
    # Convert relation to lowercase for case-insensitive matching
    relation_lemma = triple.relation.lower()

    # CAUSAL relationships: Look for verbs indicating cause or effect
    causal_verbs = {"cause", "lead", "result", "trigger", "effect", "impact", "generate", "create", "drive", "contribute"}
    if any(cv in relation_lemma for cv in causal_verbs):
        triple.relation_type = REL_TYPE_CAUSAL
        triple.confidence = min(1.0, (triple.confidence or 0.5) + 0.1) # Slightly increase confidence
        return triple

    # TEMPORAL relationships: Look for verbs indicating sequence or timing
    temporal_verbs = {"precede", "follow", "start", "end", "begin", "conclude", "during", "after", "before"}
    if any(tv in relation_lemma for tv in temporal_verbs):
        triple.relation_type = REL_TYPE_TEMPORAL
        triple.confidence = min(1.0, (triple.confidence or 0.5) + 0.05)
        return triple

    # HIERARCHICAL relationships: Often involve "is a" or verbs implying inclusion/composition
    hierarchical_verbs = {"be", "include", "contain", "comprise", "consist", "part_of", "type_of"}
    if any(hv in relation_lemma for hv in hierarchical_verbs):
        # More sophisticated checks could involve entity types (e.g., if object is a broader category)
        triple.relation_type = REL_TYPE_HIERARCHICAL
        triple.confidence = min(1.0, (triple.confidence or 0.5) + 0.05)
        return triple

    # STRUCTURAL relationships: Default for many SVOs that describe how entities are connected or interact
    # This catches relationships like "works_at", "collaborates_with", etc., if not already classified.
    if triple.relation_type == REL_TYPE_SVO: # Only reclassify if it's still generic SVO
        triple.relation_type = REL_TYPE_STRUCTURAL
        triple.confidence = min(1.0, (triple.confidence or 0.5) + 0.02)

    return triple


def extract_svo_relationships_from_sentence(
        sent: Span,
        doc: Doc,
        meaningful_entities: List[NamedEntity]
) -> List[RelationshipTriple]:
    """
    Extracts Subject-Verb-Object relationships from a given sentence span,
    considering direct objects, objects of prepositions, and attributes.
    It also constructs a more descriptive relation text for prepositional objects.
    """
    svo_relationships: List[RelationshipTriple] = []

    for token in sent:
        # Look for verbs that could be the root of a relationship and are not weak verbs
        if token.pos_ == "VERB" and not is_weak_verb(token.lemma_):
            verb = token
            
            # Identify subjects (nominal subject, passive nominal subject, clausal subject)
            subjects = [child for child in verb.children if child.dep_ in 
                        ("nsubj", "nsubjpass", "csubj", "csubjpass")]
            
            # Identify direct objects, attributes, and objects of predicates
            objects = [child for child in verb.children if child.dep_ in ("dobj", "attr", "oprd")]
            
            # Handle prepositional phrases as objects (e.g., "works at Acme Corp")
            prepositional_phrases = [child for child in verb.children if child.dep_ == "prep"]
            for prep in prepositional_phrases:
                pobj = [child for child in prep.children if child.dep_ == "pobj"]
                if pobj:
                    objects.extend(pobj) # Add prepositional objects to the list of objects

            for subject_token in subjects:
                for object_token in objects:
                    # Map subject_token and object_token to meaningful entities.
                    # For multi-word entities, try to get the full noun chunk or entity span.
                    subject_span = None
                    for chunk in sent.noun_chunks:
                        if subject_token.i >= chunk.start and subject_token.i < chunk.end:
                            subject_span = chunk
                            break

                    if not subject_span:
                        # Fallback to single token span
                        subject_span = doc[subject_token.i : subject_token.i + 1] 

                    object_span = None
                    for chunk in sent.noun_chunks:
                        if object_token.i >= chunk.start and object_token.i < chunk.end:
                            object_span = chunk
                            break

                    if not object_span:
                        # Fallback to single token span
                        object_span = doc[object_token.i : object_token.i + 1] 

                    subject_data = get_entity_from_span(subject_span, meaningful_entities)
                    object_data = get_entity_from_span(object_span, meaningful_entities)

                    subject_text, subject_label = subject_data
                    object_text, object_label = object_data

                    if subject_text and object_text:
                        # Construct the relation text. 
                        # If it's a prepositional object, include the preposition.
                        relation_text = verb.lemma_
                        if object_token.dep_ == "pobj" and object_token.head.pos_ == "ADP":
                            relation_text = f"{verb.lemma_}_{object_token.head.lemma_}" # e.g., "works_at"
                        
                        new_triple = RelationshipTriple(
                            subject=subject_text,
                            subject_label=subject_label,
                            relation=relation_text,
                            object=object_text,
                            object_label=object_label,
                            relation_type=REL_TYPE_SVO, # Set relation type to SVO.
                            confidence=0.9  # Assign a higher confidence for direct SVO relationships
                        )

                        # Classify the SVO relationship into a more specific type
                        classified_triple = classify_svo_relationship(new_triple, doc)
                        svo_relationships.append(classified_triple)

    return svo_relationships


def extract_lca_and_head_relationships(
        doc: Doc, 
        ent1: NamedEntity, 
        ent2: NamedEntity, 
        meaningful_entities: List[NamedEntity]
) -> List[RelationshipTriple]:
    """
    Encapsulate the logic for extracting relationships based on LCA and common head dependencies, 
    including span checks and weak verb filtering
    """
    lca_and_head_relationships = []
    # Get the lowest common ancestor (LCA) of the two entities' root tokens.
    # The LCA is often a verb or a preposition that defines the relationship.
    ent1_span = doc[ent1.start_char : ent1.end_char]
    ent2_span = doc[ent2.start_char : ent2.end_char]

    # Ensure spans are not empty before accessing .root
    if not ent1_span or not ent2_span: 
        logger.debug(f"Skipping relationship due to empty span: '{ent1.text}' and '{ent2.text}'")
        return [] # Skip if either span is empty
    
    lca = find_lca(ent1_span.root, ent2_span.root)

    # Filter out semantically weak verbs as relations
    if lca and lca.lemma_ in WEAK_VERBS:
        logger.debug(f"Filtered out relationship due to weak LCA verb: \
                     '{ent1.text}' - '{lca.lemma_}' - '{ent2.text}'")
        return []

    # If the LCA is a verb or a preposition, it likely represents the relation.
    if lca and lca.pos_ in ["VERB", "AUX", "ADP"]:
        subject_text = ent1.text
        subject_label = ent1.label
        relation_text = lca.lemma_
        object_text = ent2.text
        object_label = ent2.label

        lca_and_head_relationships.append(
            RelationshipTriple(
                subject=subject_text,
                subject_label=subject_label,
                relation=relation_text,
                object=object_text,
                object_label=object_label,
                relation_type="LCA_DEPENDENCY", # Default type for LCA-based relationships
                confidence=0.7, # Default confidence
            )
        )

    # Consider relationships where one entity is a child of the other's root,
    # and the root itself is a verb or preposition.
    elif ( # Check if entities share a common head that is a verb or preposition
        ent1_span.root.head == ent2_span.root.head
        and ent1_span.root.head.pos_ in ["VERB", "AUX", "ADP"]
    ):
        if ent1_span.root.head.lemma_ in WEAK_VERBS:
            logger.debug(f"Filtered out relationship due to weak head verb: \
                         '{ent1.text}' - '{ent1_span.root.head.lemma_}' - '{ent2.text}'")
            return []
        
        subject_text = ent1.text
        subject_label = ent1.label
        relation_text = ent1_span.root.head.lemma_
        object_text = ent2.text
        object_label = ent2.label

        lca_and_head_relationships.append(
            RelationshipTriple(
                subject=subject_text,
                subject_label=subject_label,
                relation=relation_text,
                object=object_text,
                object_label=object_label,
                relation_type="HEAD_DEPENDENCY", # Default type for Head Dependency relationships
                confidence=0.6, # Default confidence
            )
        )

    return lca_and_head_relationships


def extract_causal_verb_relationship(
        span: Span, 
        doc: Doc, 
        meaningful_entities: List[NamedEntity]
) -> tuple[str, str, str, str, str]:
    """Helper to extract subject, object, and relation for CAUSAL_VERB pattern."""
    subject_span_tokens = [token for token in span if token.dep_ == "nsubj"]
    object_span_tokens = [token for token in span if token.dep_ == "dobj"]
    verb_span_tokens = [token for token in span if token.pos_ == "VERB"]

    if subject_span_tokens and object_span_tokens and verb_span_tokens:
        # Create spans from the first to the last token in the respective lists
        subject_span_obj = doc[subject_span_tokens[0].i : subject_span_tokens[-1].i + 1]
        object_span_obj = doc[object_span_tokens[0].i : object_span_tokens[-1].i + 1]

        subject_data = get_entity_from_span(subject_span_obj, meaningful_entities)
        object_data = get_entity_from_span(object_span_obj, meaningful_entities)
        subject_text, subject_label = subject_data
        object_text, object_label = object_data
        # Access the lemma of the first verb token in the list
        relation_text = verb_span_tokens[0].lemma_ if verb_span_tokens else ""
        return subject_text, subject_label, object_text, object_label, relation_text
    
    return "", "", "", "", ""


def extract_causal_preposition_relationship(
        span: Span,
        meaningful_entities: List[NamedEntity]
) -> tuple[str, str, str, str, str]:
    """Helper to extract subject, object, and relation for CAUSAL_PREPOSITION pattern."""
    noun_phrases = [chunk for chunk in span.noun_chunks]
    if len(noun_phrases) >= 2:
        # Take the first noun phrase as subject
        subject_data = get_entity_from_span(noun_phrases[0], meaningful_entities)
        # Take the last noun phrase as object
        object_data = get_entity_from_span(noun_phrases[-1], meaningful_entities)
        subject_text, subject_label = subject_data
        object_text, object_label = object_data
        relation_text = "due to"
        return subject_text, subject_label, object_text, object_label, relation_text
    
    return "", "", "", "", ""


def extract_temporal_relationship(
        span: Span, 
        doc: Doc, 
        meaningful_entities: List[NamedEntity]
) -> tuple[str, str, str, str, str]:
    """Helper to extract subject, object, and relation for TEMPORAL pattern."""
    # Find the temporal connector token within the matched span
    temporal_connector_token = None
    for token in span:
        if token.lower_ in ["before", "after", "during", "when", "while"] and token.pos_ in ["ADP", "SCONJ"]:
            temporal_connector_token = token
            break

    if temporal_connector_token:
        # The subject is the part of the span before the connector.
        subject_span_temp = doc[span.start : temporal_connector_token.i]
        # The object is the part of the span after the connector.
        object_span_temp = doc[temporal_connector_token.i + 1 : span.end]

        subject_data = get_entity_from_span(subject_span_temp, meaningful_entities)
        object_data = get_entity_from_span(object_span_temp, meaningful_entities)
        subject_text, subject_label = subject_data
        object_text, object_label = object_data
        relation_text = temporal_connector_token.text.lower()

        if subject_text and object_text and relation_text:
            return subject_text, subject_label, object_text, object_label, relation_text
        
    return "", "", "", "", ""


def extract_hierarchical_relationship(
        span: Span, 
        meaningful_entities: List[NamedEntity]
) -> tuple[str, str, str, str, str]:
    """Helper to extract subject, object, and relation for HIERARCHICAL pattern."""
    noun_phrases = [chunk for chunk in span.noun_chunks]
    if len(noun_phrases) >= 2:
        # Take the first noun phrase as the subject.
        subject_data = get_entity_from_span(noun_phrases[0], meaningful_entities)
        # Take the last noun phrase as the object.
        object_data = get_entity_from_span(noun_phrases[-1], meaningful_entities)
        subject_text, subject_label = subject_data
        object_text, object_label = object_data
        relation_text = "is a type of"
        return subject_text, subject_label, object_text, object_label, relation_text
    
    return "", "", "", "", ""


async def extract_enhanced_relationships(
        doc: Doc,
        neo4j_crud: Neo4jCRUD,
        meaningful_entities: List[NamedEntity],
        source_document_id: Optional[str] = None,
        source_sentence_id: Optional[str] = None,
) -> List[RelationshipTriple]:
    """
    Defines and applies custom spaCy Matcher patterns for enhanced relationship extraction.
    This function uses predefined patterns to identify more complex relationships
    (e.g., causal, temporal, hierarchical) beyond simple SVO structures.

    Args:
        doc (Doc): The spaCy Doc object for the text.
        neo4j_crud (Neo4jCRUD): The Neo4j CRUD instance for database operations \
            (though not used directly here).
        meaningful_entities (List[NamedEntity]): A list of pre-extracted meaningful for \
            entities subject/object resolution
        source_document_id (Optional[str]): ID of the source document.
        source_sentence_id (Optional[str]): ID of the source sentence.

    Returns:
        List[RelationshipTriple]: A list of `RelationshipTriple` objects representing
                                 the extracted enhanced relationships.
    """
    relationships = []
    matcher = Matcher(doc.vocab)

    # Causal Relationship Pattern: [CAUSE] because [EFFECT] or [EFFECT] due to [CAUSE]
    # Pattern 1: Subject --verb--> object (causal verb)
    causal_pattern_1 = [
        {"DEP": "nsubj", "OP": "+"}, # Nominal subject
        {"LEMMA": {"IN": ["cause", "lead", "result", "trigger", "effect", "impact"]}, 
                   "POS": "VERB"}, # Causal verb
        {"DEP": "dobj", "OP": "+"}, # Direct object
    ]
    matcher.add("CAUSAL_VERB", [causal_pattern_1])

    # Pattern 2: Noun phrase -- "due to" / "because of" --> Noun phrase
    causal_pattern_2 = [
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"}, # Noun or proper noun phrase
        {"LOWER": {"IN": ["because", "due"]}, "POS": "ADP"}, # Preposition like "because" or "due"
        {"LOWER": "of", "OP": "?"}, # Optional "of"
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"}, # Noun or proper noun phrase
    ]
    matcher.add("CAUSAL_PREPOSITION", [causal_pattern_2])

    # Temporal Relationship Pattern: [EVENT1] before/after [EVENT2]
    temporal_pattern = [
        {"POS": {"IN": ["NOUN", "PROPN", "VERB"]}, "OP": "+"}, # Event 1 (noun, proper noun, or verb)
        {"LOWER": {"IN": ["before", "after", "during", "when", "while"]}, 
                   "POS": {"IN": ["ADP", "SCONJ"]}}, # Temporal connector
        {"POS": {"IN": ["NOUN", "PROPN", "VERB"]}, "OP": "+"}, # Event 2 (noun, proper noun, or verb)
    ]
    matcher.add("TEMPORAL", [temporal_pattern])

    # Hierarchical Relationship Pattern: [ENTITY] is a type of [CATEGORY]
    hierarchical_pattern = [
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"}, # Entity
        {"LEMMA": "be"}, # "is"
        {"POS": "DET", "OP": "?"}, # Optional determiner "a"
        {"LOWER": "type", "OP": "?"}, # Optional "type"
        {"LOWER": "of", "OP": "?"}, # Optional "of"
        {"POS": {"IN": ["NOUN", "PROPN"]}, "OP": "+"}, # Category
    ]
    matcher.add("HIERARCHICAL", [hierarchical_pattern])

    matches = matcher(doc)

    for match_id, start, end in matches:
        span = doc[start:end]
        rule_id = doc.vocab.strings[match_id]
        subject_text = ""
        subject_label = ""
        object_text = ""
        object_label = ""
        relation_text = ""
        relation_type = ""
        confidence = 0.8 # Assign a default confidence for enhanced relationships

        if rule_id == "CAUSAL_VERB":
            subject_text, subject_label, object_text, object_label, relation_text = extract_causal_verb_relationship(
                span, doc, meaningful_entities)
            relation_type = REL_TYPE_CAUSAL
        elif rule_id == "CAUSAL_PREPOSITION":
            subject_text, subject_label, object_text, object_label, relation_text = extract_causal_preposition_relationship(
                span, meaningful_entities)
            relation_type = REL_TYPE_CAUSAL
        elif rule_id == "TEMPORAL":
            subject_text, subject_label, object_text, object_label, relation_text = extract_temporal_relationship(
                span, doc, meaningful_entities)
            relation_type = REL_TYPE_TEMPORAL
        elif rule_id == "HIERARCHICAL":
            subject_text, subject_label, object_text, object_label, relation_text = extract_hierarchical_relationship(
                span, meaningful_entities)
            relation_type = REL_TYPE_HIERARCHICAL

        if subject_text and object_text and relation_text:
            relationships.append(
                RelationshipTriple(
                    subject=subject_text,
                    subject_label=subject_label,
                    relation=relation_text,
                    object=object_text,
                    object_label=object_label,
                    relation_type=relation_type,
                    confidence=confidence,
                    relation_metadata={"pattern_id": rule_id}
                )
            )

    return relationships


def deduplicate_relationship_triples(relationships: List[RelationshipTriple]) -> List[RelationshipTriple]:
    """
    Removes duplicate relationship triples from a list.
    """
    unique_relationships = set()
    deduplicated_relationships: List[RelationshipTriple] = []

    for rel in relationships:
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
        
    return deduplicated_relationships


def filter_relationships_by_confidence(
        relationships: List[RelationshipTriple], 
        min_confidence: float
) -> List[RelationshipTriple]:
    """
    Filters a list of relationships based on a minimum confidence score.
    """
    return [rel for rel in relationships if rel.confidence >= min_confidence]


async def extract_relationships_logic(
    nlp,
    text: str,
    neo4j_crud: Neo4jCRUD,
    source_document_id: Optional[str] = None,
    source_sentence_id: Optional[str] = None,
    min_confidence: float = 0.6,
) -> ExtractedRelationships:
    """
    Extracts relationships from the input text using spaCy's dependency parsing
    and custom enhanced patterns. It focuses on identifying meaningful entities
    and the relationships between them to build a knowledge graph.

    Args:
        nlp: The loaded spaCy NLP model.
        text (str): The input text to process.
        neo4j_crud (Neo4jCRUD): The Neo4j CRUD instance for database operations.
        source_document_id (Optional[str]): ID of the source document.
        source_sentence_id (Optional[str]): ID of the source sentence.

    Returns:
        ExtractedRelationships: An object containing the extracted relationship triples
                                and the constructed knowledge graph.
    """
    # Clean the input text before processing with spaCy
    cleaned_text = clean_text(text)
    doc = nlp(cleaned_text, component_cfg={"fastcoref": {'resolve_text': True}})
    resolved_text = doc._.resolved_text
    doc = nlp(resolved_text)
    all_extracted_relationships = []
    persisted_nodes: Dict[str, Node] = {}  # Cache for already persisted nodes to avoid duplicates

    # Extract meaningful entities once for the entire document to be used for relationship extraction
    meaningful_entities = extract_meaningful_entities(doc)

    #logger.info(f"Meaningful Ents: {meaningful_entities}")
    for sent in doc.sents:
        # Extract Subject-Verb-Object relationships from each sentence using the enhanced logic.
        # This function now handles direct objects, prepositional objects, and attributes.
        svo_relationships = extract_svo_relationships_from_sentence(sent, doc, meaningful_entities)
        #logger.info(f"SVO Extracted Type: {(svo_relationships)}")
        # logger.info(f"SVO Extracted Type: {type(svo_relationships)}, \
        #                 Subject: {svo_relationships.subject}, \
        #                 Relation: {svo_relationships.relation}, \
        #                 Object: {svo_relationships.object}")
        if svo_relationships:
            # Use extend to add all relationships from the list returned by the SVO function
            all_extracted_relationships.extend(svo_relationships)
        # Iterate through meaningful entities in the sentence to find relationships between them.
        # This approach focuses on finding a verb or preposition that connects two entities.
        for ent1 in meaningful_entities:
            # Prioritize relationships between Named Entities
            if not is_strong_named_entity(ent1):
                continue # Skip if ent1 is not a strong Named Entity type

            for ent2 in meaningful_entities:
                # Ensure entities are distinct and within the current sentence
                if not is_valid_entity_pair_in_sentence(ent1, ent2, sent):
                    continue
                all_extracted_relationships.extend(
                    extract_lca_and_head_relationships(doc, ent1, ent2, meaningful_entities)
                )

    # Extract enhanced relationships using the custom Matcher patterns
    enhanced_relationships = await extract_enhanced_relationships(
        doc, neo4j_crud, meaningful_entities, source_document_id, source_sentence_id
    )
    all_extracted_relationships.extend(enhanced_relationships)

    # Deduplication Logic: Remove duplicate relationship triples
    deduplicated_relationships = deduplicate_relationship_triples(all_extracted_relationships)
    # for i, rel in enumerate(deduplicated_relationships):
    #     logger.info(f"Deduplicated Rel {i} Type: {type(rel)}, \
    #                 Subject: {rel.subject}, \
    #                 Relation: {rel.relation}, \
    #                 Object: {rel.object}")
    # Filter relationships by min_confidence before persistence and graph building
    filtered_relationships = filter_relationships_by_confidence(deduplicated_relationships, min_confidence)
    # for i, rel in enumerate(filtered_relationships):
    #     logger.info(f"Filtered Rel {i} Type: {type(rel)}, \
    #                 Subject: {rel.subject}, \
    #                 Relation: {rel.relation}, \
    #                 Object: {rel.object}")

    # Persistence Update: Persist only deduplicated relationships to Neo4j
    for rel in filtered_relationships:
        # logger.info(f"Persisting Rel Type: {type(rel)}, \
        #              Subject: {rel.subject}, \
        #              Relation: {rel.relation}, \
        #              Object: {rel.object}")
        await persist_relationship_to_neo4j(
            neo4j_crud, rel, persisted_nodes, source_document_id, source_sentence_id
        )

    # Build the in-memory knowledge graph for immediate API return
    knowledge_graph = build_knowledge_graph(filtered_relationships)

    # Return the extracted relationship triples and the knowledge graph.
    return ExtractedRelationships(relationships=filtered_relationships, graph=knowledge_graph)


def build_knowledge_graph(relationships: List[RelationshipTriple]) -> KnowledgeGraph:
    """
    Builds a KnowledgeGraph object from a list of RelationshipTriple objects.
    This function constructs the in-memory graph for immediate return,
    using the API-facing models from ..models.

    Args:
        relationships (List[RelationshipTriple]): A list of extracted relationship triples.

    Returns:
        KnowledgeGraph: A `KnowledgeGraph` object containing `GraphNode`s and `GraphRelationship`s.
    """
    nodes_map: Dict[str, GraphNode] = {}
    api_relationships: List[GraphRelationship] = []

    for triple in relationships:
        # Create or retrieve subject GraphNode
        if triple.subject not in nodes_map:
            nodes_map[triple.subject] = GraphNode(
                id=triple.subject, 
                label=triple.subject_label or ENTITY_LABEL_DEFAULT, 
                properties={"name": triple.subject}
            )
        
        # Create or retrieve object GraphNode
        if triple.object not in nodes_map:
            nodes_map[triple.object] = GraphNode(
                id=triple.object, 
                label=triple.object_label or ENTITY_LABEL_DEFAULT, 
                properties={"name": triple.object}
            )
        
        # Create relationship (GraphRelationship)
        api_relationships.append(
            GraphRelationship(
                source_id=triple.subject,
                target_id=triple.object,
                type=triple.relation,
                properties={
                    "confidence": triple.confidence,
                    "relation_metadata": triple.relation_metadata,
                }
            )
        )
    
    return KnowledgeGraph(nodes=list(nodes_map.values()), relationships=api_relationships)

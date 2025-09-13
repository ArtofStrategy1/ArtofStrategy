import spacy
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
    GraphEdge,
    NamedEntity,
)
from ..utils.graph_utils import find_lca
from ..core.processing import _extract_meaningful_entities # Import the new function

logger = logging.getLogger(__name__)


def resolve_coreferences(doc: spacy.tokens.Doc) -> spacy.tokens.Doc:
    """
    Applies coreference resolution to the doc object using fastcoref.
    It iterates through coreference clusters and updates entity spans
    to reflect the resolved coreferences.

    Args:
        doc (spacy.tokens.Doc): The spaCy Doc object potentially containing coreference clusters.

    Returns:
        spacy.tokens.Doc: The Doc object with coreferences resolved and entity spans updated.
    """
    if not hasattr(doc._, "fastcoref_clusters"):
        logger.warning("fastcoref pipeline component not found in spaCy model.")
        return doc

    # Create a mapping from coreferenced spans to their main mentions
    coref_map = {}
    for cluster in doc._.fastcoref_clusters:
        # The first mention in the cluster is typically the main mention
        main_mention_span = cluster # Access the first span in the cluster
        main_mention_text = main_mention_span.text # Extract text from the span

        for mention_span in cluster:
            # Only map if it's not the main mention itself
            if mention_span != main_mention_span:
                coref_map[mention_span.start] = main_mention_text # Use the start index of the mention span as the key

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


def _get_entity_from_span(span: spacy.tokens.Span, meaningful_entities: List[NamedEntity]) -> Optional[str]:
    """
    Attempts to find a meaningful entity that matches or is contained within the given spaCy span.
    Prioritizes exact matches, then contained entities. This helps in linking extracted
    relationship components (subjects, objects) to the refined list of meaningful entities.

    Args:
        span (spacy.tokens.Span): The spaCy span to check for entity presence.
        meaningful_entities (List[NamedEntity]): The pre-extracted list of meaningful entities.

    Returns:
        Optional[str]: The text of the matched meaningful entity, or None if no suitable entity is found.
    """
    span_text_lower = span.text.lower()

    # Check for exact match
    for entity in meaningful_entities:
        if entity.text.lower() == span_text_lower:
            return entity.text
    
    # Check for contained entities (e.g., if span is "the big apple" and "apple" is a meaningful entity)
    for entity in meaningful_entities:
        if (entity.start_char >= span.start_char and entity.end_char <= span.end_char) or \
           (span.start_char >= entity.start_char and span.end_char <= entity.end_char):
            return entity.text # Return the contained entity, or the containing entity

    return None


async def extract_enhanced_relationships(
    doc: spacy.tokens.Doc,
    neo4j_crud: Neo4jCRUD,
    meaningful_entities: List[NamedEntity], # Pass meaningful entities to use for subject/object resolution
    source_document_id: Optional[str] = None,
    source_sentence_id: Optional[str] = None,
) -> List[RelationshipTriple]:
    """
    Defines and applies custom spaCy Matcher patterns for enhanced relationship extraction.
    This function uses predefined patterns to identify more complex relationships
    (e.g., causal, temporal, hierarchical) beyond simple SVO structures.

    Args:
        doc (spacy.tokens.Doc): The spaCy Doc object for the text.
        neo4j_crud (Neo4jCRUD): The Neo4j CRUD instance for database operations (though not used directly here).
        meaningful_entities (List[NamedEntity]): A list of pre-extracted meaningful entities.
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
        {"LEMMA": {"IN": ["cause", "lead", "result", "trigger", "effect", "impact"]}, "POS": "VERB"}, # Causal verb
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
        {"LOWER": {"IN": ["before", "after", "during", "when", "while"]}, "POS": {"IN": ["ADP", "SCONJ"]}}, # Temporal connector
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
        object_text = ""
        relation_text = ""
        relation_type = ""
        confidence = 0.8 # Assign a default confidence for enhanced relationships

        if rule_id == "CAUSAL_VERB":
            # Example: "Rain causes floods"
            # Subject: Rain, Relation: causes, Object: floods
            subject_span_tokens = [token for token in span if token.dep_ == "nsubj"]
            object_span_tokens = [token for token in span if token.dep_ == "dobj"]
            verb_span_tokens = [token for token in span if token.pos_ == "VERB"]

            if subject_span_tokens and object_span_tokens and verb_span_tokens:
                # Use _get_entity_from_span to ensure meaningful entities are used as subject and object
                subject_span_obj = doc[subject_span_tokens[0].i : subject_span_tokens[-1].i + 1]
                object_span_obj = doc[object_span_tokens[0].i : object_span_tokens[-1].i + 1]

                subject_text = _get_entity_from_span(subject_span_obj, meaningful_entities)
                object_text = _get_entity_from_span(object_span_obj, meaningful_entities)
                relation_text = verb_span_tokens[0].lemma_ if verb_span_tokens else ""
                relation_type = "CAUSAL"

        elif rule_id == "CAUSAL_PREPOSITION":
            # Example: "Floods due to rain"
            # Subject: Floods, Relation: due to, Object: rain
            # This pattern is more complex to extract subject/object directly from dependency.
            # For simplicity, we'll take the first and last noun phrases and map them to meaningful entities.
            noun_phrases = [chunk for chunk in span.noun_chunks]
            if len(noun_phrases) >= 2:
                # Pass the first noun phrase (which is a Span object) as the subject
                subject_text = _get_entity_from_span(noun_phrases[0], meaningful_entities)
                object_text = _get_entity_from_span(noun_phrases[-1], meaningful_entities)
                relation_text = "due to"
                relation_type = "CAUSAL"

        elif rule_id == "TEMPORAL":
            # Example: "He ate before he slept"
            # Subject: He (ate), Relation: before, Object: he (slept)
            # This requires more sophisticated entity linking. For now,
            # we'll extract the main verbs/nouns around the temporal connector and map to meaningful entities.
            tokens_in_span = [token for token in span if token.pos_ in ["NOUN", "PROPN", "VERB"]]
            if len(tokens_in_span) >= 2:
                # Attempt to get meaningful entities for the subject and object parts
                # This is a simplification; a more robust solution would involve better span identification
                subject_span_temp = doc[tokens_in_span[0].i : tokens_in_span[-1].i + 1]
                object_span_temp = doc[tokens_in_span[-1].i : tokens_in_span[-1].i + 1]

                subject_text = _get_entity_from_span(subject_span_temp, meaningful_entities)
                object_text = _get_entity_from_span(object_span_temp, meaningful_entities)
                
                relation_text = " ".join([token.text for token in span if token.lower_ in ["before", "after", "during", "when", "while"]])
                relation_type = "TEMPORAL"

        elif rule_id == "HIERARCHICAL":
            # Example: "Apple is a type of fruit"
            # Subject: Apple, Relation: is a type of, Object: fruit
            noun_phrases = [chunk for chunk in span.noun_chunks]
            if len(noun_phrases) >= 2:
                # Pass the first noun phrase (which is a Span object) as the subject
                subject_text = _get_entity_from_span(noun_phrases[0], meaningful_entities)
                object_text = _get_entity_from_span(noun_phrases[-1], meaningful_entities)
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
    doc = nlp(text)
    doc = resolve_coreferences(doc)
    all_extracted_relationships = []
    persisted_nodes: Dict[str, Node] = {}  # Cache for already persisted nodes to avoid duplicates

    # Extract meaningful entities once for the entire document to be used for relationship extraction
    meaningful_entities = _extract_meaningful_entities(doc)

    async def get_or_create_node(entity_text: str, entity_type: str) -> Node:
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

    for sent in doc.sents:
        # Iterate through meaningful entities in the sentence to find relationships between them.
        # This approach focuses on finding a verb or preposition that connects two entities.
        for ent1 in meaningful_entities:
            # Prioritize relationships between Named Entities
            # if ent1.label not in ["ORG", "PERSON", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW", "LANGUAGE", "DATE", "TIME", "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"]:
            #     continue # Skip if ent1 is not a strong Named Entity type

            for ent2 in meaningful_entities:
                # Ensure entities are distinct and within the current sentence
                if ent1.text != ent2.text and \
                   sent.start_char <= ent1.start_char < sent.end_char and \
                   sent.start_char <= ent2.start_char < sent.end_char:
                    try:
                        # Get the lowest common ancestor (LCA) of the two entities' root tokens.
                        # The LCA is often a verb or a preposition that defines the relationship.
                        #lca = find_lca(doc[ent1.start_char].root, doc[ent2.start_char].root)
                        ent1_span = doc[ent1.start_char : ent1.end_char]
                        ent2_span = doc[ent2.start_char : ent2.end_char]
                        # Ensure spans are not empty before accessing .root
                        if not ent1_span or not ent2_span: 
                            logger.debug(f"Skipping relationship due to empty span: '{ent1.text}' and '{ent2.text}'")
                            continue # Skip if either span is empty
                        lca = find_lca(ent1_span.root, ent2_span.root)

                        # Filter out semantically weak verbs as relations
                        if lca and lca.lemma_ in ["be", "have", "do", "say", "get", "make", "go", "know", "take", "see", "come", "think", "look", "want", "give", "use", "find", "tell", "ask", "work", "seem", "feel", "try", "leave", "call"]:
                            logger.debug(f"Filtered out relationship due to weak LCA verb: '{ent1.text}' - '{lca.lemma_}' - '{ent2.text}'")
                            continue

                        # If the LCA is a verb or a preposition, it likely represents the relation.
                        if lca and lca.pos_ in ["VERB", "AUX", "ADP"]:
                            subject_text = ent1.text
                            relation_text = lca.lemma_
                            object_text = ent2.text

                            all_extracted_relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
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
                            if ent1_span.root.head.lemma_ in ["be", "have", "do", "say", "get", "make", "go", "know", "take", "see", "come", "think", "look", "want", "give", "use", "find", "tell", "ask", "work", "seem", "feel", "try", "leave", "call"]:
                                logger.debug(f"Filtered out relationship due to weak head verb: '{ent1.text}' - '{ent1_span.root.head.lemma_}' - '{ent2.text}'")
                                continue
                            subject_text = ent1.text
                            relation_text = ent1_span.root.head.lemma_
                            object_text = ent2.text

                            all_extracted_relationships.append(
                                RelationshipTriple(
                                    subject=subject_text,
                                    relation=relation_text,
                                    object=object_text,
                                    relation_type="HEAD_DEPENDENCY", # Default type for Head Dependency relationships
                                    confidence=0.6, # Default confidence
                                )
                            )
                    except Exception as e:
                        logger.warning(
                            f"Could not determine relationship between '{ent1.text}' and '{ent2.text}': {e}"
                            f" (Entities: '{ent1.text}' (label: {ent1.label}), '{ent2.text}' (label: {ent2.label}))"
                        )

        # Retain the original SVO extraction for simpler sentences where entities might not be directly linked.
        # This part now also uses _get_entity_from_span to ensure meaningful entities.
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
                # Map subject_token and object_token to meaningful entities
                subject_span_obj = doc[subject_token.i : subject_token.i + 1]
                object_span_obj = doc[object_token.i : object_token.i + 1]

                subject_text = _get_entity_from_span(subject_span_obj, meaningful_entities)
                object_text = _get_entity_from_span(object_span_obj, meaningful_entities)

                if subject_text and object_text: # Only add if both are meaningful entities
                    all_extracted_relationships.append(
                        RelationshipTriple(
                            subject=subject_text,
                            relation=root.lemma_,
                            object=object_text,
                            relation_type="SVO", # Default type for SVO
                            confidence=0.5, # Default confidence
                        )
                    )

    # Extract enhanced relationships using the custom Matcher patterns
    enhanced_relationships = await extract_enhanced_relationships(
        doc, neo4j_crud, meaningful_entities, source_document_id, source_sentence_id
    )
    all_extracted_relationships.extend(enhanced_relationships)

    # Deduplication Logic: Remove duplicate relationship triples
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

    # Filter relationships by min_confidence before persistence and graph building
    filtered_relationships = [rel for rel in deduplicated_relationships if rel.confidence >= min_confidence]

    # Persistence Update: Persist only deduplicated relationships to Neo4j
    for rel in filtered_relationships:
        # Get or create subject and object nodes in Neo4j
        subject_node = await get_or_create_node(rel.subject, "ENTITY") # Assuming ENTITY type for now
        object_node = await get_or_create_node(rel.object, "ENTITY") # Assuming ENTITY type for now

        # Prepare properties for Neo4j, flattening relation_metadata
        neo4j_properties = {
            "confidence": rel.confidence,
            "source_document_id": source_document_id,
            "source_sentence_id": source_sentence_id,
        }
        if rel.relation_metadata:
            neo4j_properties.update(rel.relation_metadata) # Flatten relation_metadata into node properties

        # Create the relationship in Neo4j
        neo4j_crud.create_relationship(
            Relationship(
                source_id=subject_node.id,
                target_id=object_node.id,
                type=rel.relation_type,
                properties=neo4j_properties, # Pass the flattened properties
            )
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
        KnowledgeGraph: A `KnowledgeGraph` object containing `GraphNode`s and `GraphEdge`s.
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
        
        # Create relationship (GraphEdge)
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

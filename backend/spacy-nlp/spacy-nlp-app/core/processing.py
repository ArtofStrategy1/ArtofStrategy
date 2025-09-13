from typing import List, Dict, Any, Optional
from ..models import ProcessedToken, NamedEntity, DependencyRelation, ProcessedText
import spacy
import logging

logger = logging.getLogger(__name__)


def _extract_meaningful_entities(doc: spacy.tokens.Doc) -> List[NamedEntity]:
    """
    Extracts meaningful entities from a spaCy Doc object, prioritizing Named Entities
    and then significant noun chunks, while filtering out stop words and short tokens.

    This function aims to create a more refined set of entities for knowledge graph
    construction, avoiding the creation of nodes for semantically weak tokens.

    Args:
        doc (spacy.tokens.Doc): The spaCy Doc object to extract entities from.

    Returns:
        List[NamedEntity]: A list of `NamedEntity` objects representing the
                           meaningful entities found in the document.
    """
    meaningful_entities = {}

    # 1. Prioritize Named Entities (NER) identified by spaCy
    for ent in doc.ents:
        meaningful_entities[ent.text.lower()] = NamedEntity(
            text=ent.text,
            label=ent.label_,
            start_char=ent.start_char,
            end_char=ent.end_char,
        )

    # 2. Add significant noun chunks, avoiding duplicates and filtering out weak tokens.
    # Noun chunks often represent important concepts not always caught by NER.
    for chunk in doc.noun_chunks:
        # Filter out noun chunks that are primarily stop words or very short,
        # or those that are already covered by a Named Entity.
        if (
            chunk.text.lower() not in meaningful_entities
            and not all(token.is_stop for token in chunk) # Corrected: Check if all tokens in chunk are stop words
            and len(chunk.text) > 1  # Filter out single-character chunks
            and any(token.is_alpha for token in chunk) # Ensure it contains at least one alphabetic character
        ):
            # Heuristic: if a noun chunk is just a stop word or punctuation, skip it
            if all(token.is_stop or token.is_punct for token in chunk):
                continue

            meaningful_entities[chunk.text.lower()] = NamedEntity(
                text=chunk.text,
                label="NOUN_CHUNK",  # Custom label for noun chunks to distinguish from NER
                start_char=chunk.start_char,
                end_char=chunk.end_char,
            )
    
    # 3. Add individual tokens that are not stop words, are alphabetic, and are not already part of a larger entity.
    # This captures single, significant words that might be entities on their own.
    for token in doc:
        if (
            token.is_alpha
            and not token.is_stop
            and len(token.text) > 1 # Filter out single-character tokens
            and token.text.lower() not in meaningful_entities
        ):
            meaningful_entities[token.text.lower()] = NamedEntity(
                text=token.text,
                label=token.pos_, # Use POS as label for individual tokens
                start_char=token.idx,
                end_char=token.idx + len(token.text),
            )


    return list(meaningful_entities.values())


def process_text_logic(nlp: Any, text: str, include_full_nlp_details: bool = False) -> ProcessedText:
    """
    Processes input text using the loaded spaCy model to perform fundamental
    Natural Language Processing (NLP) tasks.

    It returns a comprehensive `ProcessedText` object containing:
    - Tokenization: Breaking text into individual words/punctuation.
    - Lemmatization: Reducing words to their base form.
    - Part-of-Speech (POS) Tagging: Identifying grammatical categories (e.g., noun, verb).
    - Named Entity Recognition (NER): Identifying and classifying entities (e.g., persons, organizations).
    - Dependency Parsing: Analyzing grammatical relationships between words.
    - Sentence Segmentation: Dividing the text into individual sentences.
    """
    doc = nlp(text)  # Process the input text with the spaCy model

    # Extract tokens along with their lemma, POS tag, dependency relation,
    # and flags for stop words and alphabetic characters.
    processed_tokens = [
        ProcessedToken(
            text=token.text,
            lemma=token.lemma_,
            pos=token.pos_,
            dep=token.dep_,
            is_stop=token.is_stop,
            is_alpha=token.is_alpha,
        )
        for token in doc
    ]

    # Extract individual sentences from the processed document.
    sentences = [sent.text for sent in doc.sents]

    # Extract meaningful entities using the new helper function,
    # which filters out semantically weak tokens for knowledge graph construction.
    meaningful_entities = _extract_meaningful_entities(doc)

    # Extract dependency relations for each token, showing its relationship
    # to its head token in the sentence.
    dependency_relations = [
        DependencyRelation(
            token=token.text,
            dependency=token.dep_,
            head=token.head.text,
        )
        for token in doc
    ]

    # Return the comprehensive processed text data.
    return ProcessedText(
        original_text=text,
        entities=meaningful_entities, # Use the refined entities for graph construction
        tokens=processed_tokens if include_full_nlp_details else None,
        sentences=sentences,
        dependencies=dependency_relations if include_full_nlp_details else None
    )

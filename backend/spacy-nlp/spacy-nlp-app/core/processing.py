from typing import List, Dict, Any, Optional
from ..models import ProcessedToken, NamedEntity, DependencyRelation, ProcessedText


def process_text_logic(nlp: Any, text: str) -> ProcessedText:
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

    # Extract named entities, including their text, label (type),
    # and character offsets within the original text.
    named_entities = [
        NamedEntity(
            text=ent.text,
            label=ent.label_,
            start_char=ent.start_char,
            end_char=ent.end_char,
        )
        for ent in doc.ents
    ]

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
        entities=named_entities,
        tokens=processed_tokens,
        sentences=sentences,
        dependencies=dependency_relations,
    )

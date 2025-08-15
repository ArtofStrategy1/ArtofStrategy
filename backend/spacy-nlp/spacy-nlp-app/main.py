from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
import spacy
import networkx as nx
from .models import (
    TextInput,
    ProcessedToken,
    ProcessedText,
    NamedEntity,
    DependencyRelation,
    SWOTAnalysisResult,
    RelationshipTriple,
    ExtractedRelationships,
    GraphNode,
    GraphEdge,
    KnowledgeGraph,
    GraphQueryRequest,
    PathQueryRequest,
    NeighborsResponse,
    PathResponse,
    LeveragePoint,
    LeveragePointsResponse,
    PerformanceTestRequest,
    PerformanceTestResult,
)
import time
import logging
import sys
import os

# Configure logging for the application.
# This ensures that informational messages, warnings, and errors are recorded,
# which is crucial for monitoring the service's health and debugging.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variable to hold the spaCy NLP model.
# The model is loaded once at application startup to avoid redundant loading
# on every request, which would be highly inefficient.
nlp = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the FastAPI application, specifically handling
    startup and shutdown events. This context manager is used to load the
    spaCy NLP model when the application starts and release it when it shuts down.
    This ensures the model is available for all requests and resources are
    properly managed.
    """
    global nlp
    try:
        # Define the spaCy model name to be loaded. 'en_core_web_sm' is a
        # small English model that includes tokenization, POS tagging,
        # dependency parsing, and named entity recognition.
        model_name = "en_core_web_sm"
        logger.info(f"Attempting to load spaCy model: {model_name}")
        nlp = spacy.load(model_name)
        logger.info(f"Successfully loaded spaCy model: {model_name}")
    except OSError:
        # If the model is not found locally, attempt to download it.
        # This ensures the service can self-recover if the model is missing.
        logger.error(f"SpaCy model '{model_name}' not found. Downloading it...")
        try:
            spacy.cli.download(model_name)
            nlp = spacy.load(model_name)
            logger.info(f"Successfully downloaded and loaded spaCy model: {model_name}")
        except Exception as e:
            # Log and raise an HTTPException if model download or loading fails,
            # preventing the application from starting in an unready state.
            logger.error(f"Error downloading or loading spaCy model: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to load spaCy model: {e}"
            )
    except Exception as e:
        # Catch any other unexpected errors during model loading.
        logger.error(f"An unexpected error occurred during spaCy model loading: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load spaCy model: {e}")

    # The 'yield' statement indicates that the startup phase is complete,
    # and the application is ready to receive requests.
    yield

    # This block executes when the application is shutting down.
    # It releases the loaded spaCy model, freeing up resources.
    logger.info("Application is shutting down.")
    nlp = None


# Initialize the FastAPI application.
# Provides metadata like title, description, and version for API documentation.
# The 'lifespan' context manager is passed to handle startup/shutdown events.
app = FastAPI(
    title="spaCy NLP Service",
    description="A dedicated service for Natural Language Processing tasks using spaCy.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=dict)
async def health_check():
    """
    Health check endpoint.
    Returns the service status and the loaded spaCy model name.
    This endpoint is crucial for monitoring the service's availability
    and ensuring the NLP model is correctly loaded and ready for use.
    """
    if nlp:
        return {"status": "healthy", "model": nlp.meta.get("name", "Unknown")}
    else:
        # If the spaCy model is not loaded, return a 503 Service Unavailable status.
        raise HTTPException(status_code=503, detail="SpaCy model not loaded.")


@app.post("/process_text", response_model=ProcessedText)
async def process_text(request_data: TextInput):
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
    if not nlp:
        # Ensure the spaCy model is loaded before processing any text.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    text = request_data.text
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


@app.post("/analyze_swot", response_model=SWOTAnalysisResult)
async def analyze_swot(request_data: TextInput):
    """
    Performs a basic SWOT (Strengths, Weaknesses, Opportunities, Threats)
    analysis on the input text. This endpoint was implemented as part of
    "Support for SWOT/TOWS Analysis using spaCy" task.

    It identifies potential SWOT elements by:
    - Matching keywords and phrases commonly associated with each SWOT category.
    - Considering named entities that might represent strengths (e.g., organizations, products)
      or threats (e.g., events, political groups) in a very basic manner.
    The results are returned as a `SWOTAnalysisResult` object, with duplicates removed.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    text = request_data.text
    doc = nlp(text)

    strengths = []
    weaknesses = []
    opportunities = []
    threats = []

    # Define simple keyword lists for identifying SWOT elements.
    # These lists can be expanded and refined for more accurate analysis.
    strength_keywords = [
        "strong",
        "growth",
        "leader",
        "advantage",
        "efficient",
        "robust",
        "innovative",
        "market share",
        "profitable",
    ]
    weakness_keywords = [
        "poor",
        "lack",
        "weak",
        "inefficient",
        "challenge",
        "debt",
        "limited",
        "high cost",
        "outdated",
    ]
    opportunity_keywords = [
        "emerging",
        "new market",
        "expansion",
        "partnership",
        "technology",
        "untapped",
        "demand",
        "investment",
    ]
    threat_keywords = [
        "competitor",
        "regulatory",
        "crisis",
        "recession",
        "disruption",
        "risk",
        "vulnerable",
        "economic downturn",
    ]

    # Iterate through tokens to find matches with defined keywords.
    for token in doc:
        if token.is_alpha and not token.is_stop:  # Focus on meaningful words
            if any(keyword in token.text.lower() for keyword in strength_keywords):
                strengths.append(token.text)
            if any(keyword in token.text.lower() for keyword in weakness_keywords):
                weaknesses.append(token.text)
            if any(keyword in token.text.lower() for keyword in opportunity_keywords):
                opportunities.append(token.text)
            if any(keyword in token.text.lower() for keyword in threat_keywords):
                threats.append(token.text)

    # Consider named entities for potential SWOT elements.
    # This is a basic approach; more sophisticated logic would involve
    # sentiment analysis or contextual understanding of the entities.
    for ent in doc.ents:
        if ent.label_ in [
            "ORG",
            "PRODUCT",
            "GPE",
        ]:  # Organizations, Products, Geo-political entities
            if any(keyword in ent.text.lower() for keyword in strength_keywords):
                strengths.append(ent.text)
            if any(keyword in ent.text.lower() for keyword in weakness_keywords):
                weaknesses.append(ent.text)
        if ent.label_ in [
            "EVENT",
            "NORP",
        ]:  # Events, Nationalities/Religious/Political groups
            if any(keyword in ent.text.lower() for keyword in threat_keywords):
                threats.append(ent.text)

    # Return the SWOT analysis results, ensuring no duplicate entries.
    return SWOTAnalysisResult(
        strengths=list(set(strengths)),
        weaknesses=list(set(weaknesses)),
        opportunities=list(set(opportunities)),
        threats=list(set(threats)),
    )


@app.post("/extract_relationships", response_model=ExtractedRelationships)
async def extract_relationships(request_data: TextInput):
    """
    Extracts simple subject-verb-object (SVO) relationships from the input text
    using spaCy's dependency parsing. This endpoint was implemented as part of
    "Knowledge Graph Foundation using spaCy extracted data" task.

    It iterates through sentences, identifies the root verb, and then attempts
    to find a nominal subject (`nsubj`) and a direct object (`dobj`) to form
    a relationship triple. This forms a foundational step for building knowledge graphs.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    text = request_data.text
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
                        # Initialize LCA to None
                        lca = None

                        # Find LCA by traversing up from ent1.root
                        for ancestor in ent1.root.ancestors:
                            if ancestor.is_ancestor(ent2.root):
                                lca = ancestor
                                break

                        # If LCA is still None, try traversing up from ent2.root
                        if lca is None:
                            for ancestor in ent2.root.ancestors:
                                if ancestor.is_ancestor(ent1.root):
                                    lca = ancestor
                                    break

                        # If LCA is still None, it means one of the roots is the LCA of the other, or they are the same.
                        if lca is None:
                            if ent1.root.is_ancestor(ent2.root):
                                lca = ent1.root
                            elif ent2.root.is_ancestor(ent1.root):
                                lca = ent2.root
                            else:
                                # Fallback to the root of ent1 if no other LCA is found
                                lca = ent1.root

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
    # Construct an in-memory NetworkX DiGraph from the extracted relationships
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
    knowledge_graph = KnowledgeGraph(nodes=graph_nodes, edges=graph_edges)

    # Return the extracted relationship triples and the knowledge graph.
    return ExtractedRelationships(relationships=relationships, graph=knowledge_graph)


@app.post("/query_graph_neighbors", response_model=NeighborsResponse)
async def query_graph_neighbors(request_data: GraphQueryRequest):
    """
    Queries the neighbors of a given node in the graph.
    For demonstration, the graph is reconstructed from a dummy set of relationships.
    In a production environment, the graph would be persisted and loaded efficiently.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    # Dummy relationships for demonstration. In a real scenario, these would come from a persistent store.
    # For simplicity, we'll use a hardcoded set of relationships to build the graph.
    # In a more robust solution, we would load the graph from a database or a global in-memory object
    # populated by the /extract_relationships endpoint.
    dummy_relationships = [
        RelationshipTriple(subject="Apple", relation="produces", object="iPhone"),
        RelationshipTriple(subject="Apple", relation="produces", object="MacBook"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Windows"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Surface"),
        RelationshipTriple(subject="Google", relation="develops", object="Android"),
        RelationshipTriple(subject="Google", relation="owns", object="YouTube"),
        RelationshipTriple(subject="iPhone", relation="is_a", object="Smartphone"),
        RelationshipTriple(subject="MacBook", relation="is_a", object="Laptop"),
        RelationshipTriple(subject="Windows", relation="is_an", object="OS"),
    ]

    graph = nx.DiGraph()
    for triple in dummy_relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)

    node_id = request_data.node_id
    if node_id not in graph:
        raise HTTPException(
            status_code=404, detail=f"Node '{node_id}' not found in graph."
        )

    neighbors = list(graph.neighbors(node_id))
    return NeighborsResponse(neighbors=neighbors)


@app.post("/query_graph_path", response_model=PathResponse)
async def query_graph_path(request_data: PathQueryRequest):
    """
    Finds a path between two nodes in the graph.
    For demonstration, the graph is reconstructed from a dummy set of relationships.
    In a production environment, the graph would be persisted and loaded efficiently.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    # Dummy relationships for demonstration.
    dummy_relationships = [
        RelationshipTriple(subject="Apple", relation="produces", object="iPhone"),
        RelationshipTriple(subject="Apple", relation="produces", object="MacBook"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Windows"),
        RelationshipTriple(subject="Microsoft", relation="produces", object="Surface"),
        RelationshipTriple(subject="Google", relation="develops", object="Android"),
        RelationshipTriple(subject="Google", relation="owns", object="YouTube"),
        RelationshipTriple(subject="iPhone", relation="is_a", object="Smartphone"),
        RelationshipTriple(subject="MacBook", relation="is_a", object="Laptop"),
        RelationshipTriple(subject="Windows", relation="is_an", object="OS"),
    ]

    graph = nx.DiGraph()
    for triple in dummy_relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)

    source_node_id = request_data.source_node_id
    target_node_id = request_data.target_node_id

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
        raise HTTPException(
            status_code=404,
            detail=f"No path found between '{source_node_id}' and '{target_node_id}'.",
        )


@app.post("/test_performance", response_model=PerformanceTestResult)
async def test_performance(request_data: PerformanceTestRequest):
    """
    Tests the performance of the spaCy NLP model by processing a given text
    multiple times.

    It measures the total time taken to process the text for a specified
    number of iterations and calculates the average processing time per text.
    This is useful for benchmarking and identifying performance bottlenecks.
    """
    if not nlp:
        # Ensure the spaCy model is loaded.
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    text = request_data.text
    num_iterations = request_data.num_iterations

    # Validate that the number of iterations is a positive integer.
    if num_iterations <= 0:
        raise HTTPException(
            status_code=400, detail="num_iterations must be a positive integer."
        )

    # Measure the total time taken for all processing iterations.
    total_start_time = time.perf_counter()
    for _ in range(num_iterations):
        nlp(text)  # Perform the NLP processing
    total_end_time = time.perf_counter()

    # Calculate total and average processing times.
    total_processing_time_s = total_end_time - total_start_time
    average_processing_time_ms = (total_processing_time_s / num_iterations) * 1000

    # Return the performance test results.
    return PerformanceTestResult(
        average_processing_time_ms=average_processing_time_ms,
        total_processing_time_s=total_processing_time_s,
    )


@app.post("/identify_leverage_points", response_model=LeveragePointsResponse)
async def identify_leverage_points(request_data: TextInput):
    """
    Identifies leverage points in the text by constructing a knowledge graph
    and calculating node centrality.
    """
    if not nlp:
        raise HTTPException(
            status_code=503, detail="SpaCy model not loaded. Service is not ready."
        )

    text = request_data.text
    doc = nlp(text)
    relationships = []

    for sent in doc.sents:
        for ent1 in sent.ents:
            for ent2 in sent.ents:
                if ent1 != ent2:
                    try:
                        lca = None
                        for ancestor in ent1.root.ancestors:
                            if ancestor.is_ancestor(ent2.root):
                                lca = ancestor
                                break
                        if lca is None:
                            for ancestor in ent2.root.ancestors:
                                if ancestor.is_ancestor(ent1.root):
                                    lca = ancestor
                                    break
                        if lca is None:
                            if ent1.root.is_ancestor(ent2.root):
                                lca = ent1.root
                            elif ent2.root.is_ancestor(ent1.root):
                                lca = ent2.root
                            else:
                                lca = ent1.root

                        if lca and lca.pos_ in ["VERB", "AUX", "ADP"]:
                            subject = ent1.text
                            relation = lca.lemma_
                            obj = ent2.text
                            relationships.append(
                                RelationshipTriple(
                                    subject=subject, relation=relation, object=obj
                                )
                            )
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

        root = None
        for token in sent:
            if token.dep_ == "ROOT":
                root = token
                break

        if root:
            subject = None
            obj = None

            for child in root.children:
                if child.dep_ == "nsubj":
                    subject = child
                    break

            for child in root.children:
                if child.dep_ == "dobj":
                    obj = child
                    break

            if subject and obj:
                relationships.append(
                    RelationshipTriple(
                        subject=subject.text, relation=root.lemma_, object=obj.text
                    )
                )

    graph = nx.DiGraph()
    for triple in relationships:
        graph.add_node(triple.subject)
        graph.add_node(triple.object)
        graph.add_edge(triple.subject, triple.object, relation=triple.relation)

    # Calculate degree centrality
    centrality = nx.degree_centrality(graph)

    # Sort nodes by centrality score in descending order
    sorted_centrality = sorted(centrality.items(), key=lambda item: item, reverse=True)

    # Identify top N leverage points (e.g., top 10)
    top_n = 10
    leverage_points = []
    for node_id, score in sorted_centrality[:top_n]:
        leverage_points.append(LeveragePoint(node_id=node_id, centrality_score=score))

    return LeveragePointsResponse(leverage_points=leverage_points)

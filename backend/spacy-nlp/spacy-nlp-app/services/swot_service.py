from typing import List
from ..models import SWOTAnalysisResult, TextInput
import spacy


def perform_swot_analysis(nlp: spacy.Language, text: str) -> SWOTAnalysisResult:
    """
    Performs a basic SWOT (Strengths, Weaknesses, Opportunities, Threats)
    analysis on the input text.

    It identifies potential SWOT elements by:
    - Matching keywords and phrases commonly associated with each SWOT category.
    - Considering named entities that might represent strengths (e.g., organizations, products)
      or threats (e.g., events, political groups) in a very basic manner.
    The results are returned as a `SWOTAnalysisResult` object, with duplicates removed.
    """
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

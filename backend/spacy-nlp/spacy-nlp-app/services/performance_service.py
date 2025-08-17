import time
from ..models import PerformanceTestResult, PerformanceTestRequest
from spacy.language import Language


def run_performance_test(
    nlp: Language, text: str, num_iterations: int
) -> PerformanceTestResult:
    """
    Tests the performance of the spaCy NLP model by processing a given text
    multiple times.

    It measures the total time taken to process the text for a specified
    number of iterations and calculates the average processing time per text.
    This is useful for benchmarking and identifying performance bottlenecks.
    """
    # Validate that the number of iterations is a positive integer.
    if num_iterations <= 0:
        raise ValueError("num_iterations must be a positive integer.")

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

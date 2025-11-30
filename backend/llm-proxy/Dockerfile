# Use a base Python image
FROM python:3.11-slim-bookworm

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./llm-proxy-app/ /app/llm-proxy-app

# Expose the port the FastAPI app will run on inside the container.
EXPOSE 8000

# Command to run the application using Uvicorn
# --host 0.0.0.0 makes it accessible from outside the container
# --port 8000 specifies the port inside the container
CMD ["uvicorn", "llm-proxy-app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Command to run the FastAPI application using Gunicorn with Uvicorn workers for production
# Gunicorn handles process management, Uvicorn handles the ASGI server
#CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8001"]

# Use a lightweight Python base image.
FROM python:3.9-buster

# Set the working directory inside the container.
WORKDIR /app

# Copy the requirements file and install dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code.
COPY main.py .

# Expose the port the FastAPI app runs on.
EXPOSE 8000

# Command to run the application using Uvicorn
# --host 0.0.0.0 makes it accessible from outside the container
# --port 8000 specifies the port inside the container
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
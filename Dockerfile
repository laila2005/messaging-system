# Use the official Python 3.10 image
FROM python:3.10-slim

# Create a user to avoid running as root (Hugging Face requirement)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY --chown=user backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend directory
COPY --chown=user backend/ ./backend/

# Hugging Face Spaces expose port 7860 by default
EXPOSE 7860

# Start the FastAPI server on port 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]

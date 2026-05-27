FROM python:3.11-slim

# Install system dependencies required by OpenCV, DeepFace, and psycopg2
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

# Copy and install dependencies globally
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Set up a new user named "user" with user ID 1000
RUN useradd -m -u 1000 user

# Switch to the "user" user
USER user

# Set home to the user's home directory
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy the application code configuring owner as user
COPY --chown=user . $HOME/app

# Pre-download DeepFace Facenet512 model weights inside the Docker image to make cold starts instant
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Facenet512')"

# Hugging face spaces open port 7860 by default
EXPOSE 7860

# Start the app using gunicorn (1 worker is optimal for limited CPU/RAM spaces to prevent context switching & OOM restarts)
CMD ["gunicorn", "app.main:app", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:7860", "--timeout", "120"]

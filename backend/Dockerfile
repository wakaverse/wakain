FROM python:3.12-slim

# System deps: ffmpeg for video processing, libgl1 for opencv
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy video-analyzer code (bundled at build time)
COPY video-analyzer/ /app/video-analyzer/

# Copy backend app
COPY app/ /app/app/

# Expose Cloud Run default port
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

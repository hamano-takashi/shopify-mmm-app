FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PyMC
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import pymc_marketing; print('OK')" || exit 1

# Default: run the worker
CMD ["python", "-m", "src.worker"]

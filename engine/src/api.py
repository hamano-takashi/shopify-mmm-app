"""FastAPI health check and status endpoint."""

from fastapi import FastAPI

from .config import settings

app = FastAPI(title="MMM Engine", version="0.1.0")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/config")
async def config():
    """Return current MMM configuration (non-sensitive)."""
    return {
        "chains": settings.mmm_chains,
        "tune": settings.mmm_tune,
        "draws": settings.mmm_draws,
        "max_concurrent": settings.mmm_max_concurrent,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.api_host, port=settings.api_port)

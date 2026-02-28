"""Configuration for the MMM engine."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_queue: str = "mmm-analysis"

    # Database (PostgreSQL for production, SQLite path for dev)
    database_url: str = "postgresql://postgres:password@localhost:5432/shopify_mmm"

    # MMM defaults
    mmm_chains: int = 4
    mmm_tune: int = 1000
    mmm_draws: int = 500
    mmm_target_accept: float = 0.9
    mmm_max_concurrent: int = 2

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    model_config = {"env_prefix": "MMM_", "env_file": ".env"}


settings = Settings()

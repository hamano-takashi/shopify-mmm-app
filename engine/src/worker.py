"""Redis-based worker that processes MMM analysis jobs.

Listens to the 'mmm-analysis' Redis queue (compatible with BullMQ),
runs the PyMC-Marketing MMM pipeline, and writes results to the database.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import asyncpg
import pandas as pd
import redis

from .config import settings
from .models.mmm import MMMConfig, MMMRunner
from .postprocessing.result_formatter import results_to_json
from .preprocessing.data_validator import validate_mmm_data
from .preprocessing.feature_engineering import prepare_mmm_features

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class MMMWorker:
    """Worker that processes MMM analysis jobs from Redis queue."""

    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.running = True
        self.active_jobs = 0

    def run(self):
        """Main loop: listen for jobs and process them."""
        logger.info("MMM Worker started. Listening on queue: %s", settings.redis_queue)
        logger.info("Max concurrent: %d", settings.mmm_max_concurrent)

        while self.running:
            try:
                # BullMQ stores jobs in a Redis list: bull:<queue>:wait
                job_data = self.redis_client.brpop(
                    f"bull:{settings.redis_queue}:wait",
                    timeout=5,
                )

                if job_data is None:
                    continue

                _, job_id = job_data

                # Get job details from BullMQ hash
                job_key = f"bull:{settings.redis_queue}:{job_id}"
                job_info = self.redis_client.hgetall(job_key)

                if not job_info:
                    logger.warning("Job %s not found in Redis", job_id)
                    continue

                # Parse job payload
                payload = json.loads(job_info.get("data", "{}"))
                analysis_id = payload.get("analysis_id")
                shop_id = payload.get("shop_id")

                if not analysis_id:
                    logger.error("Job missing analysis_id: %s", job_id)
                    continue

                logger.info("Processing job %s (analysis: %s)", job_id, analysis_id)

                # Process the job
                self._process_job(analysis_id, shop_id, payload)

            except KeyboardInterrupt:
                logger.info("Worker shutting down...")
                self.running = False
            except Exception as e:
                logger.error("Worker error: %s", e, exc_info=True)
                time.sleep(5)

    def _process_job(
        self, analysis_id: str, shop_id: str, payload: dict
    ):
        """Process a single MMM analysis job."""
        start_time = time.time()

        try:
            # Update status to RUNNING
            asyncio.run(
                self._update_analysis_status(analysis_id, "RUNNING", started_at=datetime.now(timezone.utc))
            )

            # Load data from database
            df = asyncio.run(self._load_data(shop_id))

            if df.empty:
                raise ValueError("データが見つかりません")

            # Validate
            validation = validate_mmm_data(df)
            if not validation.is_valid:
                raise ValueError(f"バリデーションエラー: {'; '.join(validation.errors)}")

            # Feature engineering
            df = prepare_mmm_features(df)

            # Run MMM
            config = MMMConfig(
                dep_var=payload.get("dep_var", "net_sales"),
                channels=payload.get("channels"),
                chains=payload.get("chains", settings.mmm_chains),
                tune=payload.get("tune", settings.mmm_tune),
                draws=payload.get("draws", settings.mmm_draws),
            )

            runner = MMMRunner(config)
            results = runner.run(df)

            # Format and save results
            results_json = results_to_json(results.to_dict())

            elapsed = time.time() - start_time
            logger.info("Analysis %s completed in %.1fs", analysis_id, elapsed)

            asyncio.run(
                self._update_analysis_status(
                    analysis_id,
                    "COMPLETED",
                    results=results_json,
                    completed_at=datetime.now(timezone.utc),
                )
            )

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                "Analysis %s failed after %.1fs: %s",
                analysis_id,
                elapsed,
                e,
                exc_info=True,
            )

            asyncio.run(
                self._update_analysis_status(
                    analysis_id,
                    "FAILED",
                    error_msg=str(e),
                    completed_at=datetime.now(timezone.utc),
                )
            )

    async def _load_data(self, shop_id: str) -> pd.DataFrame:
        """Load merged daily data from database for a shop."""
        conn = await asyncpg.connect(settings.database_url)

        try:
            # Query all data points for this shop, pivoted by variable
            rows = await conn.fetch(
                """
                SELECT dp.date, dp.variable, dp.value
                FROM "DailyDataPoint" dp
                JOIN "DataSource" ds ON dp."dataSourceId" = ds.id
                WHERE ds."shopId" = $1
                ORDER BY dp.date, dp.variable
                """,
                shop_id,
            )

            if not rows:
                return pd.DataFrame()

            # Pivot: rows → columns per variable
            data = {}
            for row in rows:
                date_str = row["date"].strftime("%Y-%m-%d")
                variable = row["variable"]
                value = row["value"]

                if date_str not in data:
                    data[date_str] = {"date": date_str}
                data[date_str][variable] = value

            df = pd.DataFrame(list(data.values()))
            df["date"] = pd.to_datetime(df["date"])

            return df

        finally:
            await conn.close()

    async def _update_analysis_status(
        self,
        analysis_id: str,
        status: str,
        results: str | None = None,
        error_msg: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ):
        """Update analysis record in database."""
        conn = await asyncpg.connect(settings.database_url)

        try:
            updates = ['"status" = $2']
            params: list = [analysis_id, status]
            idx = 3

            if results is not None:
                updates.append(f'"results" = ${idx}')
                params.append(results)
                idx += 1

            if error_msg is not None:
                updates.append(f'"errorMsg" = ${idx}')
                params.append(error_msg)
                idx += 1

            if started_at is not None:
                updates.append(f'"startedAt" = ${idx}')
                params.append(started_at)
                idx += 1

            if completed_at is not None:
                updates.append(f'"completedAt" = ${idx}')
                params.append(completed_at)
                idx += 1

            query = f'UPDATE "Analysis" SET {", ".join(updates)} WHERE id = $1'
            await conn.execute(query, *params)

        finally:
            await conn.close()


def main():
    """Entry point for the worker."""
    worker = MMMWorker()
    worker.run()


if __name__ == "__main__":
    main()

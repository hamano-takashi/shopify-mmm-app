"""PyMC-Marketing MMM wrapper for Shopify MMM App."""

import logging
from dataclasses import dataclass
from typing import Any

import arviz as az
import numpy as np
import pandas as pd
from pymc_marketing.mmm import (
    GeometricAdstock,
    LogisticSaturation,
    MMM,
)

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class MMMConfig:
    """Configuration for a single MMM run."""

    dep_var: str = "net_sales"
    date_col: str = "date"
    channels: list[str] | None = None
    control_vars: list[str] | None = None
    chains: int = settings.mmm_chains
    tune: int = settings.mmm_tune
    draws: int = settings.mmm_draws
    target_accept: float = settings.mmm_target_accept


@dataclass
class MMMResults:
    """Results from a completed MMM run."""

    # Model fit
    r_squared: float
    mape: float

    # Channel contributions (fraction of total)
    channel_contributions: dict[str, float]

    # Channel ROAS
    channel_roas: dict[str, float]

    # Saturation curve data for each channel
    saturation_curves: dict[str, dict[str, list[float]]]

    # Budget allocation (current vs optimal)
    current_allocation: dict[str, float]
    optimal_allocation: dict[str, float]

    # Raw data for frontend charts
    actual_vs_predicted: dict[str, list[float]]

    def to_dict(self) -> dict[str, Any]:
        """Serialize results to JSON-compatible dict."""
        return {
            "r_squared": self.r_squared,
            "mape": self.mape,
            "channel_contributions": self.channel_contributions,
            "channel_roas": self.channel_roas,
            "saturation_curves": self.saturation_curves,
            "current_allocation": self.current_allocation,
            "optimal_allocation": self.optimal_allocation,
            "actual_vs_predicted": self.actual_vs_predicted,
        }


class MMMRunner:
    """Runs PyMC-Marketing MMM analysis.

    Uses GeometricAdstock for carryover effects and LogisticSaturation
    for diminishing returns modeling. MCMC sampling via PyMC/NUTS.
    """

    def __init__(self, config: MMMConfig | None = None):
        self.config = config or MMMConfig()
        self.model: MMM | None = None
        self.trace: az.InferenceData | None = None

    def run(self, df: pd.DataFrame) -> MMMResults:
        """Execute the full MMM pipeline: build → fit → extract results.

        Args:
            df: DataFrame with date, dep_var, channel costs, and controls.

        Returns:
            MMMResults with contribution, ROAS, saturation, and allocation data.
        """
        logger.info(
            "Starting MMM run: %d rows, dep_var=%s, channels=%s",
            len(df),
            self.config.dep_var,
            self.config.channels,
        )

        # Auto-detect channels if not specified
        channels = self.config.channels
        if not channels:
            channels = self._detect_channels(df)
            logger.info("Auto-detected channels: %s", channels)

        control_vars = self.config.control_vars or self._detect_controls(df, channels)

        # Build model
        self.model = self._build_model(df, channels, control_vars)

        # Fit model — X must include date column for PyMC-Marketing
        logger.info(
            "Fitting model: chains=%d, tune=%d, draws=%d",
            self.config.chains,
            self.config.tune,
            self.config.draws,
        )
        x_cols = [self.config.date_col] + channels + control_vars
        self.trace = self.model.fit(
            X=df[x_cols],
            y=df[self.config.dep_var].values,
            chains=self.config.chains,
            tune=self.config.tune,
            draws=self.config.draws,
            target_accept=self.config.target_accept,
            random_seed=42,
        )

        # Extract results
        results = self._extract_results(df, channels)
        logger.info("MMM run complete: R²=%.3f, MAPE=%.3f", results.r_squared, results.mape)

        return results

    def _detect_channels(self, df: pd.DataFrame) -> list[str]:
        """Auto-detect channel columns (those ending in _cost)."""
        cost_cols = [c for c in df.columns if c.endswith("_cost")]
        if not cost_cols:
            raise ValueError("No channel cost columns found (expected *_cost)")
        return cost_cols

    def _detect_controls(
        self, df: pd.DataFrame, channels: list[str]
    ) -> list[str]:
        """Auto-detect control variables (non-date, non-dep, non-channel)."""
        exclude = {
            self.config.date_col,
            self.config.dep_var,
            *channels,
        }
        # Also exclude impression and click columns for channels
        for ch in channels:
            prefix = ch.replace("_cost", "")
            exclude.add(f"{prefix}_imp")
            exclude.add(f"{prefix}_click")

        controls = [c for c in df.columns if c not in exclude]
        return controls

    def _build_model(
        self,
        df: pd.DataFrame,
        channels: list[str],
        control_vars: list[str],
    ) -> MMM:
        """Build PyMC-Marketing MMM with GeometricAdstock + LogisticSaturation."""
        adstock = GeometricAdstock(l_max=8)
        saturation = LogisticSaturation()

        model = MMM(
            date_column=self.config.date_col,
            channel_columns=channels,
            control_columns=control_vars if control_vars else None,
            adstock=adstock,
            saturation=saturation,
        )

        return model

    def _extract_results(
        self, df: pd.DataFrame, channels: list[str]
    ) -> MMMResults:
        """Extract all result metrics from the fitted model."""
        # Predictions
        y_actual = df[self.config.dep_var].values
        y_pred = self.model.predict(self.trace).mean(dim=["chain", "draw"]).values

        # R² score
        ss_res = np.sum((y_actual - y_pred) ** 2)
        ss_tot = np.sum((y_actual - np.mean(y_actual)) ** 2)
        r_squared = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

        # MAPE
        non_zero = y_actual != 0
        if np.any(non_zero):
            mape = float(
                np.mean(np.abs((y_actual[non_zero] - y_pred[non_zero]) / y_actual[non_zero]))
            )
        else:
            mape = 0.0

        # Channel contributions
        channel_contributions = self._calculate_contributions(channels)

        # Channel ROAS
        channel_roas = self._calculate_roas(df, channels, channel_contributions)

        # Saturation curves
        saturation_curves = self._calculate_saturation_curves(df, channels)

        # Budget allocation
        current_allocation, optimal_allocation = self._calculate_budget_allocation(
            df, channels, channel_contributions
        )

        return MMMResults(
            r_squared=r_squared,
            mape=mape,
            channel_contributions=channel_contributions,
            channel_roas=channel_roas,
            saturation_curves=saturation_curves,
            current_allocation=current_allocation,
            optimal_allocation=optimal_allocation,
            actual_vs_predicted={
                "dates": df[self.config.date_col].dt.strftime("%Y-%m-%d").tolist(),
                "actual": y_actual.tolist(),
                "predicted": y_pred.tolist(),
            },
        )

    def _calculate_contributions(self, channels: list[str]) -> dict[str, float]:
        """Calculate each channel's fractional contribution to total sales."""
        contributions = {}
        total = 0.0

        for ch in channels:
            # Get posterior mean of channel contribution
            try:
                ch_contrib = float(
                    self.trace.posterior[f"channel_contribution_{ch}"]
                    .mean(dim=["chain", "draw"])
                    .sum()
                    .values
                )
            except (KeyError, AttributeError):
                ch_contrib = 0.0

            contributions[ch] = ch_contrib
            total += ch_contrib

        # Normalize to fractions
        if total > 0:
            contributions = {k: v / total for k, v in contributions.items()}

        return contributions

    def _calculate_roas(
        self,
        df: pd.DataFrame,
        channels: list[str],
        contributions: dict[str, float],
    ) -> dict[str, float]:
        """Calculate ROAS per channel."""
        total_sales = df[self.config.dep_var].sum()
        roas = {}

        for ch in channels:
            total_cost = df[ch].sum()
            ch_sales = total_sales * contributions.get(ch, 0)
            roas[ch] = float(ch_sales / total_cost) if total_cost > 0 else 0.0

        return roas

    def _calculate_saturation_curves(
        self, df: pd.DataFrame, channels: list[str]
    ) -> dict[str, dict[str, list[float]]]:
        """Generate saturation curve data for each channel."""
        curves = {}

        for ch in channels:
            max_spend = df[ch].max() * 2  # Extend to 2x current max
            spend_range = np.linspace(0, max_spend, 50)

            # Use the model's saturation function with posterior mean parameters
            try:
                # Simplified: use logistic curve with mean posterior params
                response = self._logistic_response(spend_range, ch)
                curves[ch] = {
                    "spend": spend_range.tolist(),
                    "response": response.tolist(),
                    "current_spend": float(df[ch].mean()),
                }
            except Exception as e:
                logger.warning("Failed to compute saturation for %s: %s", ch, e)
                curves[ch] = {
                    "spend": spend_range.tolist(),
                    "response": spend_range.tolist(),
                    "current_spend": float(df[ch].mean()),
                }

        return curves

    def _logistic_response(self, x: np.ndarray, channel: str) -> np.ndarray:
        """Compute logistic saturation response curve."""
        try:
            lam = float(
                self.trace.posterior[f"saturation_lam_{channel}"]
                .mean(dim=["chain", "draw"])
                .values
            )
        except (KeyError, AttributeError):
            lam = 1.0

        return lam * x / (1 + lam * x)

    def _calculate_budget_allocation(
        self,
        df: pd.DataFrame,
        channels: list[str],
        contributions: dict[str, float],
    ) -> tuple[dict[str, float], dict[str, float]]:
        """Calculate current vs optimal budget allocation."""
        total_budget = sum(df[ch].sum() for ch in channels)

        # Current allocation
        current = {}
        for ch in channels:
            current[ch] = float(df[ch].sum() / total_budget) if total_budget > 0 else 0.0

        # Optimal: allocate proportional to marginal ROAS
        # Simplified: use contribution-weighted allocation
        total_contrib = sum(contributions.values())
        optimal = {}
        for ch in channels:
            if total_contrib > 0:
                optimal[ch] = contributions.get(ch, 0) / total_contrib
            else:
                optimal[ch] = 1.0 / len(channels)

        return current, optimal

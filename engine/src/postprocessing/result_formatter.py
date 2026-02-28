"""Format MMM results for the Shopify app frontend."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def format_results_for_frontend(results_dict: dict[str, Any]) -> dict[str, Any]:
    """Format raw MMM results into frontend-ready JSON structure.

    Organizes data into tabs matching the results page:
    - Tab 1: Channel Contribution
    - Tab 2: Saturation Curves
    - Tab 3: Budget Allocation
    - Tab 4: Model Accuracy
    - Tab 5: Download data
    """
    channel_names = _friendly_channel_names(results_dict.get("channel_contributions", {}))

    return {
        # Tab 1: Contribution
        "contribution": {
            "channels": [
                {
                    "id": ch,
                    "name": channel_names.get(ch, ch),
                    "contribution": round(pct * 100, 1),
                    "roas": round(results_dict.get("channel_roas", {}).get(ch, 0), 2),
                }
                for ch, pct in results_dict.get("channel_contributions", {}).items()
            ],
        },
        # Tab 2: Saturation
        "saturation": {
            ch: {
                "name": channel_names.get(ch, ch),
                "spend": curve.get("spend", []),
                "response": curve.get("response", []),
                "current_spend": curve.get("current_spend", 0),
            }
            for ch, curve in results_dict.get("saturation_curves", {}).items()
        },
        # Tab 3: Budget Allocation
        "budget": {
            "current": [
                {"channel": channel_names.get(ch, ch), "allocation": round(pct * 100, 1)}
                for ch, pct in results_dict.get("current_allocation", {}).items()
            ],
            "optimal": [
                {"channel": channel_names.get(ch, ch), "allocation": round(pct * 100, 1)}
                for ch, pct in results_dict.get("optimal_allocation", {}).items()
            ],
        },
        # Tab 4: Accuracy
        "accuracy": {
            "r_squared": round(results_dict.get("r_squared", 0) * 100, 1),
            "mape": round(results_dict.get("mape", 0) * 100, 1),
            "actual_vs_predicted": results_dict.get("actual_vs_predicted", {}),
        },
        # Tab 5: Raw data for export
        "raw": results_dict,
    }


def _friendly_channel_names(channels: dict[str, Any]) -> dict[str, str]:
    """Map column names to user-friendly display names."""
    name_map = {
        "google_ads_cost": "Google Ads",
        "meta_ads_cost": "Meta Ads",
        "line_ads_cost": "LINE Ads",
        "yahoo_ads_cost": "Yahoo Ads",
        "tiktok_ads_cost": "TikTok Ads",
        "amazon_ads_cost": "Amazon Ads",
        "rakuten_ads_cost": "Rakuten Ads",
    }

    result = {}
    for ch in channels:
        result[ch] = name_map.get(ch, ch.replace("_cost", "").replace("_", " ").title())
    return result


def results_to_json(results_dict: dict[str, Any]) -> str:
    """Serialize results to JSON string for database storage."""
    formatted = format_results_for_frontend(results_dict)
    return json.dumps(formatted, ensure_ascii=False, default=str)

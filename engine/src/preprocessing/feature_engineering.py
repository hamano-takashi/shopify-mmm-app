"""Feature engineering for MMM input data."""

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def prepare_mmm_features(
    df: pd.DataFrame,
    date_col: str = "date",
    dep_var: str = "net_sales",
) -> pd.DataFrame:
    """Prepare features for MMM model input.

    1. Parse and sort dates
    2. Fill missing values
    3. Add time-based features (trend, seasonality)
    4. Log-transform skewed variables
    5. Remove zero-variance columns
    """
    df = df.copy()

    # 1. Date handling
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).reset_index(drop=True)

    # 2. Fill missing values
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if col.endswith("_flag") or col.endswith("_event"):
            df[col] = df[col].fillna(0)
        elif col.endswith("_cost") or col.endswith("_imp") or col.endswith("_click"):
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].ffill().fillna(0)

    # 3. Time features
    df["trend"] = np.arange(len(df), dtype=float)

    # Day of week dummies (0=Monday, 6=Sunday)
    dow = df[date_col].dt.dayofweek
    df["is_weekend"] = (dow >= 5).astype(float)

    # Month seasonality (sin/cos encoding)
    day_of_year = df[date_col].dt.dayofyear
    df["season_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    df["season_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)

    # 4. Remove zero-variance columns (except date and dep_var)
    protected = {date_col, dep_var, "trend", "is_weekend", "season_sin", "season_cos"}
    to_drop = []
    for col in numeric_cols:
        if col not in protected and df[col].std() == 0:
            to_drop.append(col)
            logger.info("Dropping zero-variance column: %s", col)

    if to_drop:
        df = df.drop(columns=to_drop)

    logger.info(
        "Feature engineering complete: %d rows x %d columns",
        len(df),
        len(df.columns),
    )

    return df

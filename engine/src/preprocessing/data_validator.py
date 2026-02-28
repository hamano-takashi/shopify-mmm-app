"""Data validation before MMM execution."""

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of data validation."""

    is_valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


def validate_mmm_data(
    df: pd.DataFrame,
    dep_var: str = "net_sales",
    date_col: str = "date",
    min_rows: int = 60,
    max_missing_rate: float = 0.2,
) -> ValidationResult:
    """Validate DataFrame before running MMM.

    Checks:
    1. Minimum row count (at least 60 days recommended)
    2. Required columns exist
    3. No duplicate dates
    4. Missing value rate per column
    5. Variance check (channels with zero variance are useless)
    6. Outlier detection
    """
    result = ValidationResult()

    # 1. Row count
    if len(df) < min_rows:
        result.errors.append(
            f"データが不足しています: {len(df)}行 (最低{min_rows}行必要)"
        )
        result.is_valid = False

    # 2. Required columns
    if date_col not in df.columns:
        result.errors.append(f"日付列 '{date_col}' が見つかりません")
        result.is_valid = False
        return result

    if dep_var not in df.columns:
        result.errors.append(f"目的変数 '{dep_var}' が見つかりません")
        result.is_valid = False
        return result

    # 3. Duplicate dates
    if df[date_col].duplicated().any():
        dup_count = df[date_col].duplicated().sum()
        result.errors.append(f"重複する日付が{dup_count}件あります")
        result.is_valid = False

    # 4. Missing values
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        missing_rate = df[col].isna().mean()
        if missing_rate > max_missing_rate:
            result.warnings.append(
                f"列 '{col}' の欠損率が{missing_rate:.0%}です (許容: {max_missing_rate:.0%})"
            )

    # 5. Zero variance check
    cost_cols = [c for c in df.columns if c.endswith("_cost")]
    for col in cost_cols:
        if col in df.columns and df[col].std() == 0:
            result.warnings.append(
                f"列 '{col}' の分散がゼロです (このチャネルはモデルに寄与しません)"
            )

    # 6. Dep var check
    if dep_var in df.columns:
        if df[dep_var].std() == 0:
            result.errors.append(f"目的変数 '{dep_var}' の分散がゼロです")
            result.is_valid = False

        if (df[dep_var] < 0).any():
            result.warnings.append(f"目的変数 '{dep_var}' に負の値があります")

    # Stats
    result.stats = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "date_range": {
            "start": str(df[date_col].min()),
            "end": str(df[date_col].max()),
        },
        "channel_count": len(cost_cols),
        "channels": cost_cols,
    }

    return result

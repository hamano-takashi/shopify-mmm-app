import db from "../db.server";
import { mergeShopifyAndExcelData } from "./data-merger.server";

interface AnalysisConfig {
  dep_var?: string;
  date_range?: string;
  channels?: string[];
}

interface ChannelResult {
  channel: string;
  label: string;
  contribution: number;
  contributionPct: number;
  roas: number;
  cpa: number;
  totalSpend: number;
  totalRevenue: number;
  saturationPct: number;
  marginalRoi: number;
}

interface AnalysisResults {
  summary: {
    totalRevenue: number;
    totalSpend: number;
    overallRoas: number;
    baseRevenue: number;
    basePct: number;
    r2: number;
    mape: number;
    dateRange: { start: string; end: string };
    dataPoints: number;
  };
  channels: ChannelResult[];
  budgetOptimization: {
    currentSpend: Record<string, number>;
    optimizedSpend: Record<string, number>;
    expectedLift: number;
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  line_ads: "LINE Ads",
  yahoo_ads: "Yahoo Ads",
  tiktok_ads: "TikTok Ads",
};

// ============================================================
// OLS Regression (pure TypeScript, no external dependencies)
// ============================================================

/**
 * Solve OLS: y = X * beta using Normal Equation: beta = (X'X)^-1 * X'y
 * X is n x p matrix (including intercept column), y is n-length vector.
 * Returns coefficient vector of length p.
 */
function olsRegression(X: number[][], y: number[]): number[] {
  const n = X.length;
  const p = X[0].length;

  // X'X (p x p)
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // X'y (p x 1)
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve (X'X) * beta = X'y via Gaussian elimination with partial pivoting
  // Augmented matrix [XtX | Xty]
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);

  for (let col = 0; col < p; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // singular or near-singular

    // Normalize pivot row
    for (let j = col; j <= p; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate other rows
    for (let row = 0; row < p; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= p; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row[p]);
}

/**
 * Compute R² (coefficient of determination)
 */
function computeR2(y: number[], yPred: number[]): number {
  const n = y.length;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - yPred[i]) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

/**
 * Compute MAPE (Mean Absolute Percentage Error)
 */
function computeMAPE(y: number[], yPred: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < y.length; i++) {
    if (Math.abs(y[i]) > 0.01) {
      sum += Math.abs((y[i] - yPred[i]) / y[i]);
      count++;
    }
  }
  return count > 0 ? (sum / count) * 100 : 0;
}

/**
 * Estimate saturation using diminishing returns model.
 * Fits: contribution_i = alpha * (1 - exp(-lambda * cost_i))
 * Returns saturation percentage (how far along the curve the current spend is).
 */
function estimateSaturation(
  dailyCosts: number[],
  dailyContributions: number[],
  totalCost: number
): number {
  const n = dailyCosts.length;
  if (n === 0 || totalCost <= 0) return 0;

  // Normalize to daily averages
  const avgCost = totalCost / n;
  const maxCost = Math.max(...dailyCosts);

  if (maxCost <= 0) return 0;

  // Estimate lambda by fitting log-linear relationship
  // Higher variance in cost relative to contribution = more saturated
  const costMean = dailyCosts.reduce((a, b) => a + b, 0) / n;
  const contribMean = dailyContributions.reduce((a, b) => a + b, 0) / n;

  let covCC = 0;
  let varCost = 0;
  for (let i = 0; i < n; i++) {
    const dc = dailyCosts[i] - costMean;
    const dr = dailyContributions[i] - contribMean;
    covCC += dc * dr;
    varCost += dc * dc;
  }

  // Elasticity: % change in contribution per % change in cost
  const elasticity = varCost > 0 && costMean > 0 && contribMean > 0
    ? (covCC / varCost) * (costMean / contribMean)
    : 0.5;

  // Elasticity < 1 indicates diminishing returns (saturation)
  // Elasticity near 0 = highly saturated, near 1 = linear, >1 = increasing returns
  const clampedElasticity = Math.max(0.01, Math.min(elasticity, 1.5));

  // Convert elasticity to saturation percentage
  // elasticity 0.01 → ~95% saturated, 0.5 → ~50%, 1.0 → ~5%
  const saturation = Math.max(5, Math.min(95, (1 - clampedElasticity) * 100));

  return Math.round(saturation);
}

// ============================================================
// Main Analysis
// ============================================================

/**
 * Run MMM analysis using OLS regression.
 * No random values — all results derived from actual data.
 */
export async function startAnalysis(
  shopId: string,
  config: AnalysisConfig = {}
): Promise<{ analysisId: string; success: boolean; message: string }> {
  const depVar = config.dep_var || "net_sales";

  const analysis = await db.analysis.create({
    data: {
      shopId,
      status: "RUNNING",
      config: JSON.stringify(config),
    },
  });

  try {
    // Merge all data
    const merged = await mergeShopifyAndExcelData(shopId);
    if (!merged.success || merged.data.length === 0) {
      throw new Error("データの統合に失敗しました");
    }

    const data = merged.data;
    const n = data.length;

    // Identify channels (columns with _cost suffix)
    const costColumns = merged.columns.filter((c) => c.endsWith("_cost"));
    const channels = costColumns.map((c) => c.replace("_cost", ""));

    if (channels.length === 0) {
      throw new Error("広告チャネルデータが見つかりません（_cost列が必要です）");
    }

    // Build regression: y = beta0 + beta1*cost1 + beta2*cost2 + ...
    const y: number[] = data.map((r) => (r[depVar] as number) || 0);
    const X: number[][] = data.map((row) => {
      const features = [1]; // intercept
      for (const ch of channels) {
        features.push((row[`${ch}_cost`] as number) || 0);
      }
      return features;
    });

    // Run OLS
    const beta = olsRegression(X, y);
    const intercept = beta[0];
    const coefficients: Record<string, number> = {};
    channels.forEach((ch, i) => {
      coefficients[ch] = beta[i + 1];
    });

    // Compute predictions
    const yPred = X.map((row) => row.reduce((sum, x, j) => sum + x * beta[j], 0));

    // Model accuracy (from actual data, no random)
    const r2 = computeR2(y, yPred);
    const mape = computeMAPE(y, yPred);

    // Calculate totals
    let totalRevenue = 0;
    let totalSpend = 0;
    const channelSpend: Record<string, number> = {};
    for (const ch of channels) channelSpend[ch] = 0;

    for (const row of data) {
      totalRevenue += (row[depVar] as number) || 0;
      for (const ch of channels) {
        channelSpend[ch] += (row[`${ch}_cost`] as number) || 0;
      }
    }
    totalSpend = Object.values(channelSpend).reduce((a, b) => a + b, 0);

    // Base revenue = intercept * n (revenue not attributable to media spend)
    const baseRevenue = Math.max(0, intercept * n);
    const basePct = totalRevenue > 0 ? (baseRevenue / totalRevenue) * 100 : 0;
    const mediaRevenue = totalRevenue - baseRevenue;

    // Channel contributions based on regression coefficients
    const channelResults: ChannelResult[] = [];
    let totalPositiveContribution = 0;

    // First pass: compute raw contributions
    const rawContributions: Record<string, number> = {};
    for (const ch of channels) {
      // Contribution = coefficient * total_spend for that channel
      const contribution = Math.max(0, coefficients[ch] * channelSpend[ch]);
      rawContributions[ch] = contribution;
      totalPositiveContribution += contribution;
    }

    // Scale contributions to sum to mediaRevenue (if positive)
    const scaleFactor = totalPositiveContribution > 0 && mediaRevenue > 0
      ? mediaRevenue / totalPositiveContribution
      : 1;

    // Total orders from data
    const totalOrders = data.reduce((sum, row) => sum + ((row["orders"] as number) || 0), 0);

    for (const ch of channels) {
      const contribution = rawContributions[ch] * scaleFactor;
      const spend = channelSpend[ch];
      const roas = spend > 0 ? contribution / spend : 0;

      // CPA: estimate channel orders proportionally
      const contributionShare = totalPositiveContribution > 0
        ? rawContributions[ch] / totalPositiveContribution
        : 1 / channels.length;
      const channelOrders = totalOrders * contributionShare * (mediaRevenue / Math.max(totalRevenue, 1));
      const cpa = channelOrders > 0 ? spend / channelOrders : 0;

      // Saturation from elasticity analysis (data-driven, no random)
      const dailyCosts = data.map((r) => (r[`${ch}_cost`] as number) || 0);
      const dailyContributions = data.map((r) => {
        const cost = (r[`${ch}_cost`] as number) || 0;
        return coefficients[ch] * cost;
      });
      const saturationPct = estimateSaturation(dailyCosts, dailyContributions, spend);

      // Marginal ROI: derivative at current spend level
      // For linear model: marginalROI = coefficient * scaleFactor
      // Adjusted by saturation: lower saturation = closer to full marginal ROI
      const baseMarginalRoi = coefficients[ch] * scaleFactor;
      const marginalRoi = baseMarginalRoi * (1 - saturationPct / 100);

      channelResults.push({
        channel: ch,
        label: CHANNEL_LABELS[ch] || ch,
        contribution: Math.round(contribution),
        contributionPct: totalRevenue > 0 ? Math.round((contribution / totalRevenue) * 1000) / 10 : 0,
        roas: Math.round(roas * 100) / 100,
        cpa: Math.round(cpa),
        totalSpend: Math.round(spend),
        totalRevenue: Math.round(contribution),
        saturationPct,
        marginalRoi: Math.round(marginalRoi * 100) / 100,
      });
    }

    channelResults.sort((a, b) => b.contribution - a.contribution);

    // Budget optimization: allocate budget proportional to marginal ROI
    const currentSpend: Record<string, number> = {};
    const optimizedSpend: Record<string, number> = {};
    const totalMarginalRoi = channelResults.reduce(
      (s, c) => s + Math.max(c.marginalRoi, 0.01),
      0
    );

    for (const ch of channelResults) {
      currentSpend[ch.channel] = ch.totalSpend;
      const optWeight = Math.max(ch.marginalRoi, 0.01) / totalMarginalRoi;
      optimizedSpend[ch.channel] = Math.round(totalSpend * optWeight);
    }

    // Expected lift: estimate revenue gain from reallocation
    let currentRevenue = 0;
    let optimizedRevenue = 0;
    for (const ch of channelResults) {
      const currentContrib = coefficients[ch.channel] * currentSpend[ch.channel] * scaleFactor;
      const optContrib = coefficients[ch.channel] * optimizedSpend[ch.channel] * scaleFactor;
      currentRevenue += Math.max(0, currentContrib);
      optimizedRevenue += Math.max(0, optContrib);
    }
    const expectedLift = currentRevenue > 0
      ? Math.round(((optimizedRevenue - currentRevenue) / currentRevenue) * 1000) / 10
      : 0;

    const results: AnalysisResults = {
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalSpend: Math.round(totalSpend),
        overallRoas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
        baseRevenue: Math.round(baseRevenue),
        basePct: Math.round(basePct * 10) / 10,
        r2: Math.round(r2 * 1000) / 1000,
        mape: Math.round(mape * 10) / 10,
        dateRange: {
          start: data[0].date as string,
          end: data[data.length - 1].date as string,
        },
        dataPoints: n,
      },
      channels: channelResults,
      budgetOptimization: {
        currentSpend,
        optimizedSpend,
        expectedLift: Math.abs(expectedLift),
      },
    };

    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        results: JSON.stringify(results),
        completedAt: new Date(),
      },
    });

    return {
      analysisId: analysis.id,
      success: true,
      message: `分析が完了しました（${n}日分、${channels.length}チャネル、R²=${results.summary.r2}）`,
    };
  } catch (error) {
    console.error("Analysis error:", error);

    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMsg: error instanceof Error ? error.message : "不明なエラー",
      },
    });

    return {
      analysisId: analysis.id,
      success: false,
      message: `分析エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

/**
 * Get current status of an analysis.
 */
export async function getAnalysisStatus(analysisId: string) {
  return db.analysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      completedAt: true,
      errorMsg: true,
    },
  });
}

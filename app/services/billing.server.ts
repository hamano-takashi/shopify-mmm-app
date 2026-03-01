import db from "../db.server";
import { PLAN_STARTER, PLAN_PRO } from "../constants/plans";

export type PlanName = "FREE" | "STARTER" | "PRO";

const PLAN_FEATURES: Record<PlanName, {
  analysisPerMonth: number; // -1 = unlimited
  excelExport: boolean;
  channelDetails: boolean;
  budgetOptimization: boolean;
  saturationAnalysis: boolean;
  marginalRoi: boolean;
}> = {
  FREE: {
    analysisPerMonth: 1,
    excelExport: false,
    channelDetails: false,
    budgetOptimization: false,
    saturationAnalysis: false,
    marginalRoi: false,
  },
  STARTER: {
    analysisPerMonth: -1,
    excelExport: true,
    channelDetails: true,
    budgetOptimization: false,
    saturationAnalysis: false,
    marginalRoi: false,
  },
  PRO: {
    analysisPerMonth: -1,
    excelExport: true,
    channelDetails: true,
    budgetOptimization: true,
    saturationAnalysis: true,
    marginalRoi: true,
  },
};

/**
 * Get feature flags for a given plan.
 */
export function getPlanFeatures(plan: string) {
  const normalized = normalizePlan(plan);
  return PLAN_FEATURES[normalized];
}

/**
 * Normalize legacy plan names to new ones.
 */
export function normalizePlan(plan: string): PlanName {
  const upper = plan.toUpperCase();
  if (upper === "PRO" || upper === "PREMIUM") return "PRO";
  if (upper === "STARTER" || upper === "PAID") return "STARTER";
  return "FREE";
}

/**
 * Map Shopify billing plan name to our internal plan name.
 */
export function billingPlanToInternal(shopifyPlanName: string): PlanName {
  if (shopifyPlanName === PLAN_PRO) return "PRO";
  if (shopifyPlanName === PLAN_STARTER) return "STARTER";
  return "FREE";
}

/**
 * Sync billing status from Shopify to local DB.
 * Call billing.check() and update Shop record accordingly.
 */
export async function syncBillingStatus(
  shopDomain: string,
  billing: {
    check: (options?: any) => Promise<{
      hasActivePayment: boolean;
      appSubscriptions: Array<{ id: string; name: string; status: string }>;
    }>;
  },
): Promise<PlanName> {
  const { hasActivePayment, appSubscriptions } = await billing.check();

  if (!hasActivePayment || appSubscriptions.length === 0) {
    // No active subscription — set to FREE
    await db.shop.update({
      where: { shopDomain },
      data: { plan: "FREE", subscriptionId: null },
    });
    return "FREE";
  }

  // Find the active subscription
  const activeSub = appSubscriptions.find((s) => s.status === "ACTIVE") || appSubscriptions[0];
  const plan = billingPlanToInternal(activeSub.name);

  await db.shop.update({
    where: { shopDomain },
    data: {
      plan,
      subscriptionId: activeSub.id,
      trialEndsAt: null,
    },
  });

  return plan;
}

/**
 * Check if a shop can run an analysis this month.
 * Free plan: 1 analysis per calendar month.
 * Starter/Pro: unlimited.
 */
export async function canRunAnalysis(shopId: string, plan: string): Promise<{
  allowed: boolean;
  reason?: string;
  used: number;
  limit: number;
}> {
  const features = getPlanFeatures(plan);
  const limit = features.analysisPerMonth;

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  // Count analyses this calendar month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await db.analysis.count({
    where: {
      shopId,
      createdAt: { gte: startOfMonth },
    },
  });

  if (count >= limit) {
    return {
      allowed: false,
      reason: `Free plan allows ${limit} analysis per month. Upgrade to Starter for unlimited analyses.`,
      used: count,
      limit,
    };
  }

  return { allowed: true, used: count, limit };
}

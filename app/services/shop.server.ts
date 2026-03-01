import db from "../db.server";

/**
 * Ensure a Shop record exists for the given domain.
 * Called on every authenticated request to handle first-time installs.
 */
export async function ensureShop(shopDomain: string): Promise<{
  id: string;
  shopDomain: string;
  plan: string;
  subscriptionId: string | null;
  trialEndsAt: Date | null;
}> {
  const existing = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (existing) {
    return existing;
  }

  // First install: create shop with Free plan
  const shop = await db.shop.create({
    data: {
      shopDomain,
      plan: "FREE",
    },
  });

  console.log(`New shop created: ${shopDomain} (FREE plan)`);

  return shop;
}

/**
 * Check if a shop's trial has expired.
 */
export async function isTrialExpired(shopDomain: string): Promise<boolean> {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) return true;
  if (shop.plan !== "TRIAL") return false;
  if (!shop.trialEndsAt) return false;

  return new Date() > shop.trialEndsAt;
}

/**
 * Update shop plan.
 */
export async function updateShopPlan(
  shopDomain: string,
  plan: string
): Promise<void> {
  await db.shop.update({
    where: { shopDomain },
    data: {
      plan,
      trialEndsAt: null, // Clear trial on plan change
    },
  });
}

/**
 * Delete all data for a shop (GDPR compliance).
 * Uses Prisma cascade deletion via the Shop model.
 */
export async function deleteShopData(shopDomain: string): Promise<boolean> {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) return false;

  // Cascade delete: Shop -> DataSource -> DailyDataPoint, Shop -> Analysis
  await db.shop.delete({
    where: { id: shop.id },
  });

  console.log(`All data deleted for shop: ${shopDomain}`);
  return true;
}

/**
 * Get shop data for GDPR data request.
 * Returns all stored data associated with a shop.
 */
export async function getShopData(shopDomain: string) {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
    include: {
      dataSources: {
        include: {
          dataPoints: true,
        },
      },
      analyses: true,
    },
  });

  return shop;
}

import db from "../db.server";

/**
 * Seed test data directly into the database.
 * Creates realistic daily sales data for the last 90 days.
 * No Shopify API calls needed - purely local test data.
 */
export async function seedTestData(
  shopId: string
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    // Ensure SHOPIFY_AUTO data source exists
    let dataSource = await db.dataSource.findFirst({
      where: { shopId, type: "SHOPIFY_AUTO" },
    });

    if (!dataSource) {
      dataSource = await db.dataSource.create({
        data: {
          shopId,
          type: "SHOPIFY_AUTO",
          status: "ACTIVE",
          lastSync: new Date(),
        },
      });
    }

    let totalCount = 0;
    const today = new Date();

    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);

      // Weekday factor (weekends have lower sales)
      const dayOfWeek = date.getDay();
      const weekdayFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0;

      // Trend: gradual growth over time
      const trendFactor = 1 + (90 - daysAgo) * 0.003;

      // Random noise
      const noise = () => 0.8 + Math.random() * 0.4;

      // Base metrics
      const baseOrders = 15 * weekdayFactor * trendFactor * noise();
      const avgOrderValue = 4200 + Math.random() * 1600;
      const baseSales = baseOrders * avgOrderValue;
      const baseDiscounts = baseSales * (0.05 + Math.random() * 0.08);
      const baseSessions = baseOrders * (25 + Math.random() * 15);
      const basePageviews = baseSessions * (2.5 + Math.random() * 1.5);
      const baseAddToCarts = baseSessions * (0.08 + Math.random() * 0.06);

      const metrics: Record<string, number> = {
        net_sales: Math.round(baseSales),
        orders: Math.round(baseOrders),
        discounts: Math.round(baseDiscounts),
        sessions: Math.round(baseSessions),
        pageviews: Math.round(basePageviews),
        add_to_carts: Math.round(baseAddToCarts),
      };

      for (const [variable, value] of Object.entries(metrics)) {
        await db.dailyDataPoint.upsert({
          where: {
            dataSourceId_date_variable: {
              dataSourceId: dataSource.id,
              date,
              variable,
            },
          },
          update: { value },
          create: {
            dataSourceId: dataSource.id,
            date,
            variable,
            value,
          },
        });
        totalCount++;
      }
    }

    // Update data source status
    await db.dataSource.update({
      where: { id: dataSource.id },
      data: {
        status: "ACTIVE",
        lastSync: new Date(),
      },
    });

    return {
      success: true,
      message: `Generated ${totalCount} test data points (91 days)`,
      count: totalCount,
    };
  } catch (error) {
    console.error("Seed test data error:", error);
    return {
      success: false,
      message: `Test data generation error: ${error instanceof Error ? error.message : "Unknown"}`,
      count: 0,
    };
  }
}

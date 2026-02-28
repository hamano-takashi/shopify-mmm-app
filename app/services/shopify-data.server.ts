import db from "../db.server";

// The admin object from authenticate.admin() has a graphql method
interface AdminGraphQL {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

// GraphQL query to fetch orders (uses read_orders scope only)
const ORDERS_QUERY = `#graphql
  query FetchOrders($query: String!, $cursor: String) {
    orders(first: 250, query: $query, after: $cursor, sortKey: CREATED_AT) {
      edges {
        node {
          id
          createdAt
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface OrderNode {
  id: string;
  createdAt: string;
  totalPriceSet: { shopMoney: { amount: string } };
  totalDiscountsSet: { shopMoney: { amount: string } };
  subtotalPriceSet: { shopMoney: { amount: string } };
}

/**
 * Fetch all orders for the last 180 days using GraphQL Admin API.
 * Only requires read_orders scope.
 */
async function fetchAllOrders(admin: AdminGraphQL): Promise<OrderNode[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 180);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  const allOrders: OrderNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(ORDERS_QUERY, {
      variables: {
        query: `created_at:>=${sinceDateStr}`,
        cursor,
      },
    });

    const { data } = await response.json();
    const orders = data?.orders;

    if (!orders) break;

    for (const edge of orders.edges) {
      allOrders.push(edge.node);
    }

    hasNextPage = orders.pageInfo.hasNextPage;
    cursor = orders.pageInfo.endCursor;
  }

  return allOrders;
}

/**
 * Aggregate orders into daily data points.
 */
function aggregateOrdersByDay(
  orders: OrderNode[]
): Array<{ date: Date; variable: string; value: number }> {
  const dailyMap = new Map<string, { net_sales: number; orders: number; discounts: number }>();

  for (const order of orders) {
    const dateStr = order.createdAt.split("T")[0];

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { net_sales: 0, orders: 0, discounts: 0 });
    }

    const day = dailyMap.get(dateStr)!;
    day.net_sales += parseFloat(order.subtotalPriceSet.shopMoney.amount);
    day.orders += 1;
    day.discounts += parseFloat(order.totalDiscountsSet.shopMoney.amount);
  }

  const dataPoints: Array<{ date: Date; variable: string; value: number }> = [];

  for (const [dateStr, values] of dailyMap) {
    const date = new Date(dateStr + "T00:00:00Z");
    dataPoints.push({ date, variable: "net_sales", value: values.net_sales });
    dataPoints.push({ date, variable: "orders", value: values.orders });
    dataPoints.push({ date, variable: "discounts", value: values.discounts });
  }

  return dataPoints;
}

/**
 * Sync Shopify order data for a shop.
 * Uses Orders GraphQL API (read_orders scope only, no ShopifyQL needed).
 */
export async function syncShopifyData(
  admin: AdminGraphQL,
  shopId: string
): Promise<{ success: boolean; message: string; count: number }> {
  // Ensure a SHOPIFY_AUTO data source exists
  let dataSource = await db.dataSource.findFirst({
    where: { shopId, type: "SHOPIFY_AUTO" },
  });

  if (!dataSource) {
    dataSource = await db.dataSource.create({
      data: {
        shopId,
        type: "SHOPIFY_AUTO",
        status: "SYNCING",
      },
    });
  } else {
    await db.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "SYNCING" },
    });
  }

  let totalCount = 0;

  try {
    // Fetch orders and aggregate by day
    const orders = await fetchAllOrders(admin);
    const dataPoints = aggregateOrdersByDay(orders);

    for (const point of dataPoints) {
      await db.dailyDataPoint.upsert({
        where: {
          dataSourceId_date_variable: {
            dataSourceId: dataSource.id,
            date: point.date,
            variable: point.variable,
          },
        },
        update: { value: point.value },
        create: {
          dataSourceId: dataSource.id,
          date: point.date,
          variable: point.variable,
          value: point.value,
        },
      });
      totalCount++;
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
      message: `${totalCount}件のデータポイントを同期しました（${orders.length}件の注文から集計）`,
      count: totalCount,
    };
  } catch (error) {
    console.error("Shopify data sync error:", error);

    await db.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "ERROR" },
    });

    return {
      success: false,
      message: `同期エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
      count: 0,
    };
  }
}

/**
 * Process a single order from webhook payload.
 * Updates (upserts) the daily aggregated data for that order's date.
 */
export async function processOrderWebhook(
  shopDomain: string,
  orderPayload: {
    created_at: string;
    subtotal_price: string;
    total_discounts: string;
  }
): Promise<void> {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) {
    console.log(`Webhook: shop not found for ${shopDomain}`);
    return;
  }

  let dataSource = await db.dataSource.findFirst({
    where: { shopId: shop.id, type: "SHOPIFY_AUTO" },
  });

  if (!dataSource) {
    dataSource = await db.dataSource.create({
      data: {
        shopId: shop.id,
        type: "SHOPIFY_AUTO",
        status: "ACTIVE",
        lastSync: new Date(),
      },
    });
  }

  const dateStr = orderPayload.created_at.split("T")[0];
  const date = new Date(dateStr + "T00:00:00Z");
  const netSales = parseFloat(orderPayload.subtotal_price) || 0;
  const discounts = parseFloat(orderPayload.total_discounts) || 0;

  // Upsert each metric: add to existing value for the day
  for (const { variable, value } of [
    { variable: "net_sales", value: netSales },
    { variable: "orders", value: 1 },
    { variable: "discounts", value: discounts },
  ]) {
    const existing = await db.dailyDataPoint.findUnique({
      where: {
        dataSourceId_date_variable: {
          dataSourceId: dataSource.id,
          date,
          variable,
        },
      },
    });

    await db.dailyDataPoint.upsert({
      where: {
        dataSourceId_date_variable: {
          dataSourceId: dataSource.id,
          date,
          variable,
        },
      },
      update: { value: (existing?.value || 0) + value },
      create: {
        dataSourceId: dataSource.id,
        date,
        variable,
        value,
      },
    });
  }

  await db.dataSource.update({
    where: { id: dataSource.id },
    data: { lastSync: new Date() },
  });
}

/**
 * Get a summary of Shopify data for a shop.
 */
export async function getShopifyDataSummary(shopId: string) {
  const dataSource = await db.dataSource.findFirst({
    where: { shopId, type: "SHOPIFY_AUTO" },
  });

  if (!dataSource) {
    return { hasData: false, lastSync: null, pointCount: 0, dateRange: null };
  }

  const pointCount = await db.dailyDataPoint.count({
    where: { dataSourceId: dataSource.id },
  });

  const dateRange = await db.dailyDataPoint.aggregate({
    where: { dataSourceId: dataSource.id },
    _min: { date: true },
    _max: { date: true },
  });

  return {
    hasData: pointCount > 0,
    lastSync: dataSource.lastSync,
    pointCount,
    dateRange: {
      start: dateRange._min.date,
      end: dateRange._max.date,
    },
  };
}

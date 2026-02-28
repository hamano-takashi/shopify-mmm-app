import db from "../db.server";

// The admin object from authenticate.admin() has a graphql method
interface AdminGraphQL {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

// ShopifyQL queries for data extraction
const SALES_QUERY = `
  FROM sales
  SHOW net_sales, orders, new_customers, returning_customers, discounts
  GROUP BY day
  SINCE -180d
  ORDER BY day ASC
`;

const SESSIONS_QUERY = `
  FROM sessions
  SHOW sessions, pageviews, online_store_visitors, add_to_carts
  GROUP BY day
  SINCE -180d
  ORDER BY day ASC
`;

// GraphQL mutation to execute ShopifyQL
const SHOPIFYQL_MUTATION = `#graphql
  mutation ShopifyQLQuery($query: String!) {
    shopifyqlQuery(query: $query) {
      __typename
      ... on TableResponse {
        tableData {
          rowData
          columns {
            name
            dataType
          }
        }
      }
      ... on PollResponse {
        partialDataId
      }
      ... on ParseError {
        code
        message
        range {
          start { line character }
          end { line character }
        }
      }
    }
  }
`;

// GraphQL query for polling partial results
const POLL_QUERY = `#graphql
  query PollShopifyQL($partialDataId: String!) {
    shopifyqlQuery(partialDataId: $partialDataId) {
      __typename
      ... on TableResponse {
        tableData {
          rowData
          columns {
            name
            dataType
          }
        }
      }
      ... on PollResponse {
        partialDataId
      }
    }
  }
`;

interface ShopifyQLColumn {
  name: string;
  dataType: string;
}

interface ShopifyQLTableData {
  rowData: string[][];
  columns: ShopifyQLColumn[];
}

interface ShopifyQLResult {
  tableData: ShopifyQLTableData;
}

/**
 * Execute a ShopifyQL query with polling support for large datasets.
 */
export async function fetchShopifyQLData(
  admin: AdminGraphQL,
  query: string,
  maxRetries = 10
): Promise<ShopifyQLResult | null> {
  const response = await admin.graphql(SHOPIFYQL_MUTATION, {
    variables: { query },
  });

  const { data } = await response.json();
  const result = data?.shopifyqlQuery;

  if (!result) {
    console.error("ShopifyQL query returned no result");
    return null;
  }

  if (result.__typename === "ParseError") {
    console.error(`ShopifyQL parse error: ${result.message} (${result.code})`);
    return null;
  }

  if (result.__typename === "TableResponse") {
    return { tableData: result.tableData };
  }

  // PollResponse: need to poll for results
  if (result.__typename === "PollResponse") {
    let partialDataId = result.partialDataId;
    let retries = 0;

    while (retries < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const pollResponse = await admin.graphql(POLL_QUERY, {
        variables: { partialDataId },
      });

      const pollData = await pollResponse.json();
      const pollResult = pollData?.data?.shopifyqlQuery;

      if (pollResult?.__typename === "TableResponse") {
        return { tableData: pollResult.tableData };
      }

      if (pollResult?.__typename === "PollResponse") {
        partialDataId = pollResult.partialDataId;
      }

      retries++;
    }

    console.error("ShopifyQL polling timed out");
    return null;
  }

  return null;
}

/**
 * Parse ShopifyQL table data into daily data points.
 */
function parseTableData(
  tableData: ShopifyQLTableData
): Array<{ date: Date; variable: string; value: number }> {
  const { columns, rowData } = tableData;
  const dataPoints: Array<{ date: Date; variable: string; value: number }> = [];

  // Find the date column index
  const dateColIndex = columns.findIndex(
    (col) => col.name === "day" || col.dataType === "date"
  );

  if (dateColIndex === -1) {
    console.error("No date column found in ShopifyQL response");
    return [];
  }

  for (const row of rowData) {
    const dateStr = row[dateColIndex];
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) continue;

    for (let i = 0; i < columns.length; i++) {
      if (i === dateColIndex) continue;

      const colName = columns[i].name;
      const rawValue = row[i];
      const value = parseFloat(rawValue);

      if (!isNaN(value)) {
        dataPoints.push({ date, variable: colName, value });
      }
    }
  }

  return dataPoints;
}

/**
 * Sync Shopify sales and session data for a shop.
 * Fetches via ShopifyQL and upserts into DailyDataPoint table.
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
    // Fetch sales data
    const salesResult = await fetchShopifyQLData(admin, SALES_QUERY);
    if (salesResult) {
      const salesPoints = parseTableData(salesResult.tableData);
      for (const point of salesPoints) {
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
    }

    // Fetch sessions data
    const sessionsResult = await fetchShopifyQLData(admin, SESSIONS_QUERY);
    if (sessionsResult) {
      const sessionPoints = parseTableData(sessionsResult.tableData);
      for (const point of sessionPoints) {
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
      message: `${totalCount}件のデータポイントを同期しました`,
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

import db from "../db.server";

interface MergedDataRow {
  date: string; // yyyy-mm-dd
  [variable: string]: string | number;
}

interface MergeResult {
  success: boolean;
  data: MergedDataRow[];
  columns: string[];
  rowCount: number;
  message: string;
}

/**
 * Merge Shopify auto-fetched data with Excel-uploaded data by date.
 * - Shopify data: sales, sessions, customers (from DailyDataPoint)
 * - Excel data: media channels, context variables (from DailyDataPoint)
 * - Missing values: forward-fill for metrics, zero-fill for flags/costs
 */
export async function mergeShopifyAndExcelData(
  shopId: string
): Promise<MergeResult> {
  // Get all data sources for the shop
  const dataSources = await db.dataSource.findMany({
    where: { shopId },
    include: {
      dataPoints: {
        orderBy: { date: "asc" },
      },
    },
  });

  if (dataSources.length === 0) {
    return {
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      message: "No data sources found",
    };
  }

  // Collect all unique dates and variables
  const dateMap = new Map<string, Record<string, number>>();
  const allVariables = new Set<string>();

  for (const source of dataSources) {
    for (const point of source.dataPoints) {
      const dateKey = point.date.toISOString().slice(0, 10);
      allVariables.add(point.variable);

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {});
      }
      dateMap.get(dateKey)![point.variable] = point.value;
    }
  }

  // Sort dates
  const sortedDates = Array.from(dateMap.keys()).sort();
  const variables = Array.from(allVariables).sort();

  // Variables that should use forward-fill (metrics)
  const forwardFillVars = new Set([
    "net_sales",
    "orders",
    "sessions",
    "pageviews",
    "online_store_visitors",
    "new_customers",
    "returning_customers",
    "add_to_carts",
    "line_friends",
    "temperature",
  ]);

  // Forward-fill and zero-fill
  const mergedData: MergedDataRow[] = [];
  const lastValues: Record<string, number> = {};

  for (const dateKey of sortedDates) {
    const dayData = dateMap.get(dateKey)!;
    const row: MergedDataRow = { date: dateKey };

    for (const variable of variables) {
      if (dayData[variable] !== undefined) {
        row[variable] = dayData[variable];
        lastValues[variable] = dayData[variable];
      } else if (forwardFillVars.has(variable) && lastValues[variable] !== undefined) {
        // Forward-fill for metrics
        row[variable] = lastValues[variable];
      } else {
        // Zero-fill for flags, costs, impressions, clicks
        row[variable] = 0;
      }
    }

    mergedData.push(row);
  }

  const columns = ["date", ...variables];

  return {
    success: true,
    data: mergedData,
    columns,
    rowCount: mergedData.length,
    message: `Merged ${mergedData.length} days of data (${variables.length} variables)`,
  };
}

/**
 * Export merged data as CSV for the Python MMM engine.
 */
export async function exportMergedDataAsCSV(shopId: string): Promise<string> {
  const result = await mergeShopifyAndExcelData(shopId);

  if (!result.success || result.data.length === 0) {
    throw new Error(result.message || "No data to export");
  }

  // Build CSV
  const lines: string[] = [];

  // Header
  lines.push(result.columns.join(","));

  // Data rows
  for (const row of result.data) {
    const values = result.columns.map((col) => {
      const val = row[col];
      if (val === undefined || val === null) return "0";
      return String(val);
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Save Excel-uploaded data to DailyDataPoint table.
 */
export async function saveExcelData(
  shopId: string,
  parsedData: Array<{ date: Date; variables: Record<string, number> }>
): Promise<{ success: boolean; count: number }> {
  // Find or create EXCEL_UPLOAD data source
  let dataSource = await db.dataSource.findFirst({
    where: { shopId, type: "EXCEL_UPLOAD" },
  });

  if (!dataSource) {
    dataSource = await db.dataSource.create({
      data: {
        shopId,
        type: "EXCEL_UPLOAD",
        status: "ACTIVE",
      },
    });
  }

  let count = 0;

  // Upsert each data point
  for (const row of parsedData) {
    for (const [variable, value] of Object.entries(row.variables)) {
      // Skip Shopify-auto columns (those are managed separately)
      const shopifyVars = [
        "net_sales", "orders", "sessions", "pageviews",
        "new_customers", "returning_customers",
        "online_store_visitors", "add_to_carts",
      ];
      if (shopifyVars.includes(variable)) continue;

      await db.dailyDataPoint.upsert({
        where: {
          dataSourceId_date_variable: {
            dataSourceId: dataSource.id,
            date: row.date,
            variable,
          },
        },
        update: { value },
        create: {
          dataSourceId: dataSource.id,
          date: row.date,
          variable,
          value,
        },
      });
      count++;
    }
  }

  // Update data source
  await db.dataSource.update({
    where: { id: dataSource.id },
    data: {
      status: "ACTIVE",
      lastSync: new Date(),
    },
  });

  return { success: true, count };
}

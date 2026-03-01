import ExcelJS from "exceljs";
import db from "../db.server";

// Default media channels for the template
const DEFAULT_CHANNELS = [
  { id: "google_ads", label: "Google Ads" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "line_ads", label: "LINE Ads" },
  { id: "yahoo_ads", label: "Yahoo Ads" },
  { id: "tiktok_ads", label: "TikTok Ads" },
];

// Variable suffixes for each channel
const CHANNEL_SUFFIXES = ["_imp", "_click", "_cost"];

// Context variables
const CONTEXT_VARIABLES = [
  { id: "event_flag", label: "Event Flag" },
  { id: "cf_flag", label: "CF Flag" },
  { id: "pr_flag", label: "PR Flag" },
  { id: "temperature", label: "Temperature" },
  { id: "line_friends", label: "LINE Friends" },
];

interface TemplateOptions {
  shopId: string;
  channels?: typeof DEFAULT_CHANNELS;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Generate an Excel template for media data input.
 * Pre-fills date column based on Shopify data period.
 * Shopify auto-fetch columns are grayed out (read-only).
 */
export async function generateExcelTemplate(
  options: TemplateOptions
): Promise<Buffer> {
  const { shopId, channels = DEFAULT_CHANNELS } = options;

  // Determine date range from existing Shopify data or defaults
  let startDate = options.startDate;
  let endDate = options.endDate;

  if (!startDate || !endDate) {
    const shopifySource = await db.dataSource.findFirst({
      where: { shopId, type: "SHOPIFY_AUTO" },
    });

    if (shopifySource) {
      const dateRange = await db.dailyDataPoint.aggregate({
        where: { dataSourceId: shopifySource.id },
        _min: { date: true },
        _max: { date: true },
      });

      startDate = startDate || dateRange._min.date || new Date();
      endDate = endDate || dateRange._max.date || new Date();
    } else {
      // Default: last 180 days
      endDate = endDate || new Date();
      startDate = startDate || new Date(endDate.getTime() - 180 * 24 * 60 * 60 * 1000);
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MMM Analytics for Shopify";
  workbook.created = new Date();

  // --- Sheet 1: Media Data ---
  const mediaSheet = workbook.addWorksheet("Media Data", {
    properties: { defaultColWidth: 15 },
  });

  // Build headers
  const headers: string[] = ["date"];

  // Shopify auto columns (grayed out in template)
  const shopifyColumns = [
    "net_sales",
    "orders",
    "sessions",
    "pageviews",
    "new_customers",
    "returning_customers",
  ];
  headers.push(...shopifyColumns);

  // Media channel columns
  for (const channel of channels) {
    for (const suffix of CHANNEL_SUFFIXES) {
      headers.push(`${channel.id}${suffix}`);
    }
  }

  // Context variables
  for (const ctx of CONTEXT_VARIABLES) {
    headers.push(ctx.id);
  }

  // Add header row
  const headerRow = mediaSheet.addRow(headers);

  // Style header row
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      bottom: { style: "thin" },
    };

    const colName = headers[colNumber - 1];

    if (colName === "date") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2EFDA" }, // light green
      };
    } else if (shopifyColumns.includes(colName)) {
      // Shopify auto columns: gray background
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }, // gray
      };
      cell.font = { bold: true, size: 11, color: { argb: "FF808080" } };
    } else if (colName.endsWith("_cost")) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" }, // light yellow
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCE6F1" }, // light blue
      };
    }
  });

  // Add sub-header row with descriptive labels
  const subHeaders: string[] = ["Date"];
  subHeaders.push(
    "Net Sales",
    "Orders",
    "Sessions",
    "Pageviews",
    "New Customers",
    "Returning Customers"
  );

  for (const channel of channels) {
    subHeaders.push(
      `${channel.label} Imp`,
      `${channel.label} Click`,
      `${channel.label} Cost`
    );
  }

  for (const ctx of CONTEXT_VARIABLES) {
    subHeaders.push(ctx.label);
  }

  const subHeaderRow = mediaSheet.addRow(subHeaders);
  subHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { size: 10, italic: true };
    cell.alignment = { horizontal: "center" };

    const colName = headers[colNumber - 1];
    if (shopifyColumns.includes(colName)) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
      cell.font = { size: 10, italic: true, color: { argb: "FF808080" } };
    }
  });

  // Pre-fill date column
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs);

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate.getTime() + i * dayMs);
    const row = mediaSheet.addRow([date]);

    // Format date cell
    row.getCell(1).numFmt = "yyyy-mm-dd";

    // Gray out Shopify columns
    for (let j = 2; j <= shopifyColumns.length + 1; j++) {
      row.getCell(j).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" }, // very light gray
      };
    }
  }

  // Set column widths
  mediaSheet.getColumn(1).width = 12; // date
  for (let i = 2; i <= headers.length; i++) {
    mediaSheet.getColumn(i).width = 14;
  }

  // Freeze panes: header + date column
  mediaSheet.views = [
    { state: "frozen", xSplit: 1, ySplit: 2 },
  ];

  // --- Sheet 2: Instructions ---
  const instrSheet = workbook.addWorksheet("Instructions", {
    properties: { defaultColWidth: 50 },
  });

  instrSheet.addRow(["MMM Analytics Template Instructions"]);
  instrSheet.getRow(1).font = { bold: true, size: 14 };
  instrSheet.addRow([]);
  instrSheet.addRow(["1. Gray columns (Shopify data) are auto-fetched. No input needed."]);
  instrSheet.addRow(["2. Yellow columns (Cost) — enter daily ad spend."]);
  instrSheet.addRow(["3. Blue columns (Imp/Click) — enter impressions and clicks."]);
  instrSheet.addRow(["4. Context variables (Event Flag, etc.) — enter 1 on applicable dates."]);
  instrSheet.addRow([]);
  instrSheet.addRow(["How to export data from each platform:"]);
  instrSheet.addRow(["  Google Ads: Admin Console → Reports → Download by day"]);
  instrSheet.addRow(["  Meta Ads: Ads Manager → Export → Daily breakdown"]);
  instrSheet.addRow(["  LINE Ads: LINE Ads → Performance Report → Daily"]);
  instrSheet.addRow(["  Yahoo Ads: Search/Display Ads → Reports → Daily"]);
  instrSheet.addRow([]);
  instrSheet.addRow(["Notes:"]);
  instrSheet.addRow(["  - Use yyyy-mm-dd date format"]);
  instrSheet.addRow(["  - Blank cells are treated as 0"]);
  instrSheet.addRow(["  - Outliers will trigger warnings during upload"]);

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Get available channel options for a shop.
 */
export function getDefaultChannels() {
  return DEFAULT_CHANNELS;
}

/**
 * Get context variable options.
 */
export function getContextVariables() {
  return CONTEXT_VARIABLES;
}

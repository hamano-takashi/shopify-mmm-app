import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import ExcelJS from "exceljs";
import { ensureShop } from "../services/shop.server";
import { getPlanFeatures, normalizePlan } from "../services/billing.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const analysisId = params.id;

  if (!analysisId) {
    throw new Response("Analysis ID is required", { status: 400 });
  }

  // Check plan allows export
  const shop = await ensureShop(session.shop);
  const features = getPlanFeatures(normalizePlan(shop.plan));
  if (!features.excelExport) {
    throw new Response("Excel export requires Starter plan or higher", { status: 403 });
  }

  const analysis = await db.analysis.findFirst({
    where: {
      id: analysisId,
      shop: { shopDomain: session.shop },
      status: "COMPLETED",
    },
  });

  if (!analysis || !analysis.results) {
    throw new Response("Analysis results not found", { status: 404 });
  }

  const results = JSON.parse(analysis.results);
  const timestamp = new Date(analysis.createdAt).toISOString().slice(0, 10);

  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: Summary ---
  const summarySheet = workbook.addWorksheet("Summary");
  const s = results.summary;

  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 25 },
    { header: "Value", key: "value", width: 25 },
  ];

  const summaryRows = [
    { metric: "Analysis Period", value: `${s.dateRange.start} - ${s.dateRange.end}` },
    { metric: "Data Points", value: `${s.dataPoints} days` },
    { metric: "Total Revenue", value: s.totalRevenue },
    { metric: "Total Ad Spend", value: s.totalSpend },
    { metric: "Overall ROAS", value: `${s.overallRoas}x` },
    { metric: "Base Revenue", value: s.baseRevenue },
    { metric: "Base Revenue Ratio", value: `${s.basePct}%` },
    { metric: "R² (Coefficient of Determination)", value: s.r2 },
    { metric: "MAPE (Mean Absolute % Error)", value: `${s.mape}%` },
  ];

  summaryRows.forEach((row) => summarySheet.addRow(row));

  // Style header
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5C6AC4" },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // --- Sheet 2: Channel Details ---
  const channelSheet = workbook.addWorksheet("Channel Details");
  channelSheet.columns = [
    { header: "Channel", key: "label", width: 18 },
    { header: "Revenue Contribution", key: "contribution", width: 20 },
    { header: "Share (%)", key: "contributionPct", width: 12 },
    { header: "Ad Spend", key: "totalSpend", width: 16 },
    { header: "ROAS", key: "roas", width: 10 },
    { header: "CPA", key: "cpa", width: 12 },
    { header: "Saturation (%)", key: "saturationPct", width: 14 },
    { header: "Marginal ROI", key: "marginalRoi", width: 14 },
  ];

  for (const ch of results.channels) {
    channelSheet.addRow({
      label: ch.label,
      contribution: ch.contribution,
      contributionPct: ch.contributionPct,
      totalSpend: ch.totalSpend,
      roas: ch.roas,
      cpa: ch.cpa,
      saturationPct: ch.saturationPct,
      marginalRoi: ch.marginalRoi,
    });
  }

  channelSheet.getRow(1).font = { bold: true };
  channelSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5C6AC4" },
  };
  channelSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Number format for currency columns
  channelSheet.getColumn("contribution").numFmt = "#,##0";
  channelSheet.getColumn("totalSpend").numFmt = "#,##0";
  channelSheet.getColumn("cpa").numFmt = "#,##0";

  // --- Sheet 3: Budget Optimization ---
  const budgetSheet = workbook.addWorksheet("Budget Optimization");
  budgetSheet.columns = [
    { header: "Channel", key: "label", width: 18 },
    { header: "Current Budget", key: "current", width: 16 },
    { header: "Recommended Budget", key: "optimized", width: 20 },
    { header: "Change Amount", key: "diff", width: 16 },
    { header: "Change (%)", key: "diffPct", width: 12 },
  ];

  const bo = results.budgetOptimization;
  for (const ch of results.channels) {
    const current = bo.currentSpend[ch.channel] || 0;
    const optimized = bo.optimizedSpend[ch.channel] || 0;
    const diff = optimized - current;
    const diffPct = current > 0 ? Math.round((diff / current) * 100) : 0;
    budgetSheet.addRow({
      label: ch.label,
      current,
      optimized,
      diff,
      diffPct,
    });
  }

  // Total row
  const totalCurrent = Object.values(bo.currentSpend as Record<string, number>).reduce((a, b) => a + b, 0);
  const totalOptimized = Object.values(bo.optimizedSpend as Record<string, number>).reduce((a, b) => a + b, 0);
  const totalRow = budgetSheet.addRow({
    label: "Total",
    current: totalCurrent,
    optimized: totalOptimized,
    diff: totalOptimized - totalCurrent,
    diffPct: "",
  });
  totalRow.font = { bold: true };

  // Add expected lift
  budgetSheet.addRow({});
  budgetSheet.addRow({ label: `Estimated Revenue Lift: +${bo.expectedLift}%` });

  budgetSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  budgetSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5C6AC4" },
  };
  budgetSheet.getColumn("current").numFmt = "#,##0";
  budgetSheet.getColumn("optimized").numFmt = "#,##0";
  budgetSheet.getColumn("diff").numFmt = "#,##0";

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=mmm-report-${timestamp}.xlsx`,
    },
  });
};

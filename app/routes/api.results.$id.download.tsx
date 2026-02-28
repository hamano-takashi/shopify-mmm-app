import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import ExcelJS from "exceljs";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const analysisId = params.id;

  if (!analysisId) {
    throw new Response("Analysis ID is required", { status: 400 });
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

  // --- Sheet 1: サマリー ---
  const summarySheet = workbook.addWorksheet("サマリー");
  const s = results.summary;

  summarySheet.columns = [
    { header: "指標", key: "metric", width: 25 },
    { header: "値", key: "value", width: 25 },
  ];

  const summaryRows = [
    { metric: "分析期間", value: `${s.dateRange.start} 〜 ${s.dateRange.end}` },
    { metric: "データポイント数", value: `${s.dataPoints}日` },
    { metric: "総売上", value: s.totalRevenue },
    { metric: "総広告費", value: s.totalSpend },
    { metric: "総合ROAS", value: `${s.overallRoas}x` },
    { metric: "ベース売上", value: s.baseRevenue },
    { metric: "ベース売上比率", value: `${s.basePct}%` },
    { metric: "R²（決定係数）", value: s.r2 },
    { metric: "MAPE（平均絶対誤差率）", value: `${s.mape}%` },
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

  // --- Sheet 2: チャネル詳細 ---
  const channelSheet = workbook.addWorksheet("チャネル詳細");
  channelSheet.columns = [
    { header: "チャネル", key: "label", width: 18 },
    { header: "貢献売上", key: "contribution", width: 16 },
    { header: "貢献度(%)", key: "contributionPct", width: 12 },
    { header: "広告費", key: "totalSpend", width: 16 },
    { header: "ROAS", key: "roas", width: 10 },
    { header: "CPA", key: "cpa", width: 12 },
    { header: "飽和度(%)", key: "saturationPct", width: 12 },
    { header: "限界ROI", key: "marginalRoi", width: 12 },
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

  // --- Sheet 3: 予算最適化 ---
  const budgetSheet = workbook.addWorksheet("予算最適化");
  budgetSheet.columns = [
    { header: "チャネル", key: "label", width: 18 },
    { header: "現在予算", key: "current", width: 16 },
    { header: "推奨予算", key: "optimized", width: 16 },
    { header: "変動額", key: "diff", width: 14 },
    { header: "変動率(%)", key: "diffPct", width: 12 },
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
    label: "合計",
    current: totalCurrent,
    optimized: totalOptimized,
    diff: totalOptimized - totalCurrent,
    diffPct: "",
  });
  totalRow.font = { bold: true };

  // Add expected lift
  budgetSheet.addRow({});
  budgetSheet.addRow({ label: `推定売上リフト: +${bo.expectedLift}%` });

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

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const shop = await ensureShop(shopDomain);

  const analyses = await db.analysis.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const dataSourceCount = await db.dataSource.count({
    where: { shopId: shop.id },
  });

  const dailyDataCount = await db.dailyDataPoint.count({
    where: { dataSource: { shopId: shop.id } },
  });

  const shopifySource = await db.dataSource.findFirst({
    where: { shopId: shop.id, type: "SHOPIFY_AUTO" },
  });

  const excelSource = await db.dataSource.findFirst({
    where: { shopId: shop.id, type: "EXCEL_UPLOAD" },
  });

  const completedCount = analyses.filter((a) => a.status === "COMPLETED").length;
  const latestCompleted = analyses.find((a) => a.status === "COMPLETED");

  let latestResults = null;
  if (latestCompleted?.results) {
    try {
      latestResults = JSON.parse(latestCompleted.results);
    } catch {}
  }

  return {
    shopDomain,
    analyses,
    dataSourceCount,
    dailyDataCount,
    completedCount,
    latestCompleted,
    latestResults,
    shopifyLastSync: shopifySource?.lastSync?.toISOString() || null,
    excelUploaded: !!excelSource,
  };
};

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "未同期";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING": return "待機中";
    case "RUNNING": return "実行中";
    case "COMPLETED": return "完了";
    case "FAILED": return "失敗";
    default: return status;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "#108043";
    case "RUNNING": return "#B98900";
    case "FAILED": return "#DE3618";
    default: return "#637381";
  }
}

export default function Dashboard() {
  const {
    analyses,
    dataSourceCount,
    dailyDataCount,
    completedCount,
    latestCompleted,
    latestResults,
    shopifyLastSync,
    excelUploaded,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const hasData = dataSourceCount > 0 || dailyDataCount > 0;
  const hasAnalysis = completedCount > 0;

  let currentStep = 1;
  if (hasData) currentStep = 2;
  if (hasAnalysis) currentStep = 3;

  return (
    <s-page title="ダッシュボード">
      <s-layout>
        {/* Header */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <s-text variant="headingLg">MMM Analytics</s-text>
                  <s-box padding-block-start="100">
                    <s-text variant="bodyMd" tone="subdued">
                      各チャネルの真の貢献度を把握し、予算配分を最適化
                    </s-text>
                  </s-box>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <s-button onClick={() => navigate("/app/data")}>データ準備</s-button>
                  <s-button variant="primary" onClick={() => navigate("/app/analysis")}>分析実行</s-button>
                </div>
              </div>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Data Status Cards */}
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <s-text variant="bodySm" tone="subdued">Shopifyデータ</s-text>
                <span style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: shopifyLastSync ? "#108043" : "#919EAB",
                }} />
              </div>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{dailyDataCount.toLocaleString()}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">
                データポイント | 最終同期: {timeAgo(shopifyLastSync)}
              </s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <s-text variant="bodySm" tone="subdued">広告データ</s-text>
                <span style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: excelUploaded ? "#108043" : "#919EAB",
                }} />
              </div>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{excelUploaded ? "連携済" : "未連携"}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">
                {excelUploaded ? "Excelアップロード済み" : "Excelアップロードが必要"}
              </s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">完了した分析</s-text>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{completedCount}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">
                {latestCompleted
                  ? `最新: ${new Date(latestCompleted.createdAt).toLocaleDateString("ja-JP")}`
                  : "まだ分析が実行されていません"}
              </s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Latest Analysis Results Summary */}
        {latestResults && (
          <>
            <s-layout-section fullWidth>
              <s-card>
                <s-box padding="400">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <s-text variant="headingMd">最新の分析サマリー</s-text>
                    <s-button
                      size="slim"
                      onClick={() => navigate(`/app/results/${latestCompleted!.id}`)}
                    >
                      詳細を見る
                    </s-button>
                  </div>

                  {/* Summary KPIs */}
                  <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>総売上</div>
                      <div style={{ fontSize: "24px", fontWeight: 700 }}>{formatYen(latestResults.summary.totalRevenue)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>総広告費</div>
                      <div style={{ fontSize: "24px", fontWeight: 700 }}>{formatYen(latestResults.summary.totalSpend)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>総合ROAS</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: latestResults.summary.overallRoas >= 3 ? "#108043" : "#202223" }}>
                        {latestResults.summary.overallRoas}x
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>モデル精度 (R²)</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: latestResults.summary.r2 >= 0.8 ? "#108043" : "#EEC200" }}>
                        {latestResults.summary.r2}
                      </div>
                    </div>
                  </div>

                  {/* Top Channels */}
                  <s-text variant="headingSm">チャネル別貢献度</s-text>
                  <div style={{ marginTop: "12px" }}>
                    {latestResults.channels.slice(0, 5).map((ch: any, i: number) => (
                      <div key={ch.channel} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < latestResults.channels.length - 1 ? "1px solid #F1F1F1" : "none" }}>
                        <span style={{ width: "24px", textAlign: "center", color: "#637381", fontSize: "12px" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 500 }}>{ch.label}</span>
                        <span style={{ color: "#637381", fontSize: "13px" }}>{formatYen(ch.contribution)}</span>
                        <span style={{ width: "60px", textAlign: "right", fontWeight: 600, color: ch.roas >= 3 ? "#108043" : ch.roas >= 1 ? "#202223" : "#DE3618" }}>
                          {ch.roas}x
                        </span>
                        <span style={{ width: "50px", textAlign: "right", color: "#637381", fontSize: "13px" }}>
                          {ch.contributionPct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </s-box>
              </s-card>
            </s-layout-section>
          </>
        )}

        {/* Onboarding Guide (shown until first analysis is complete) */}
        {!hasAnalysis && (
          <s-layout-section fullWidth>
            <s-card>
              <s-box padding="400">
                <s-text variant="headingMd">はじめかた</s-text>
                <s-box padding-block-start="300">
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {[
                      { step: 1, done: hasData, label: "データを準備する", desc: "Shopifyデータの同期と、広告データのExcelアップロード", link: "/app/data", btnLabel: "データ準備へ", showBtn: !hasData },
                      { step: 2, done: hasAnalysis, label: "分析を実行する", desc: "MMMを実行して、チャネルごとの貢献度・ROAS・飽和曲線を算出", link: "/app/analysis", btnLabel: "分析実行へ", showBtn: hasData && !hasAnalysis },
                      { step: 3, done: false, label: "結果を確認する", desc: "貢献度チャート・飽和曲線・最適予算配分を確認し、施策に活かす", link: "", btnLabel: "", showBtn: false },
                    ].map((s) => (
                      <div key={s.step} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                          backgroundColor: s.done ? "#108043" : currentStep >= s.step ? "#5C6AC4" : "#DFE3E8",
                          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 600, fontSize: "13px",
                        }}>
                          {s.done ? "\u2713" : s.step}
                        </div>
                        <div>
                          <s-text variant="bodyMd" fontWeight="semibold">{s.label}</s-text>
                          <s-text variant="bodySm" tone="subdued">{s.desc}</s-text>
                          {s.showBtn && (
                            <s-box padding-block-start="200">
                              <s-button variant="primary" size="slim" onClick={() => navigate(s.link)}>{s.btnLabel}</s-button>
                            </s-box>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </s-box>
              </s-box>
            </s-card>
          </s-layout-section>
        )}

        {/* Recent Analyses Table */}
        {analyses.length > 0 && (
          <s-layout-section fullWidth>
            <s-card>
              <s-box padding="400">
                <s-text variant="headingMd">分析履歴</s-text>
                <s-box padding-block-start="200">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                        <th style={{ textAlign: "left", padding: "8px" }}>ID</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>ステータス</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>作成日</th>
                        <th style={{ textAlign: "right", padding: "8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.map((analysis) => (
                        <tr key={analysis.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
                          <td style={{ padding: "8px", fontFamily: "monospace" }}>#{analysis.id.slice(0, 8)}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ color: getStatusColor(analysis.status), fontWeight: 600 }}>
                              {getStatusLabel(analysis.status)}
                            </span>
                          </td>
                          <td style={{ padding: "8px", color: "#637381" }}>
                            {new Date(analysis.createdAt).toLocaleString("ja-JP")}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            {analysis.status === "COMPLETED" && (
                              <s-button size="slim" variant="plain" onClick={() => navigate(`/app/results/${analysis.id}`)}>
                                結果を見る
                              </s-button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </s-box>
              </s-box>
            </s-card>
          </s-layout-section>
        )}
      </s-layout>
    </s-page>
  );
}

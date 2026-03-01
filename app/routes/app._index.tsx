import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { normalizePlan } from "../services/billing.server";

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
    plan: normalizePlan(shop.plan),
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

function formatCurrency(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Not synced";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING": return "Pending";
    case "RUNNING": return "Running";
    case "COMPLETED": return "Completed";
    case "FAILED": return "Failed";
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
    plan,
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
    <s-page title="Dashboard">
      <s-layout>
        {/* Header */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <s-text variant="headingLg">MMM Analytics</s-text>
                    <s-badge tone={plan === "FREE" ? "info" : "success"}>{plan} Plan</s-badge>
                  </div>
                  <s-box padding-block-start="100">
                    <s-text variant="bodyMd" tone="subdued">
                      Understand each channel's true contribution and optimize your budget allocation
                    </s-text>
                  </s-box>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {plan === "FREE" && (
                    <s-button onClick={() => navigate("/app/plans")}>Upgrade</s-button>
                  )}
                  <s-button onClick={() => navigate("/app/data")}>Data Setup</s-button>
                  <s-button variant="primary" onClick={() => navigate("/app/analysis")}>Run Analysis</s-button>
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
                <s-text variant="bodySm" tone="subdued">Shopify Data</s-text>
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
                Data points | Last sync: {timeAgo(shopifyLastSync)}
              </s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <s-text variant="bodySm" tone="subdued">Ad Data</s-text>
                <span style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: excelUploaded ? "#108043" : "#919EAB",
                }} />
              </div>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{excelUploaded ? "Connected" : "Not connected"}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">
                {excelUploaded ? "Excel uploaded" : "Excel upload required"}
              </s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">Completed Analyses</s-text>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{completedCount}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">
                {latestCompleted
                  ? `Latest: ${new Date(latestCompleted.createdAt).toLocaleDateString("en-US")}`
                  : "No analyses run yet"}
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
                    <s-text variant="headingMd">Latest Analysis Summary</s-text>
                    <s-button
                      size="slim"
                      onClick={() => navigate(`/app/results/${latestCompleted!.id}`)}
                    >
                      View Details
                    </s-button>
                  </div>

                  {/* Summary KPIs */}
                  <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>Total Revenue</div>
                      <div style={{ fontSize: "24px", fontWeight: 700 }}>{formatCurrency(latestResults.summary.totalRevenue)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>Total Ad Spend</div>
                      <div style={{ fontSize: "24px", fontWeight: 700 }}>{formatCurrency(latestResults.summary.totalSpend)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>Overall ROAS</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: latestResults.summary.overallRoas >= 3 ? "#108043" : "#202223" }}>
                        {latestResults.summary.overallRoas}x
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: "140px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "8px" }}>
                      <div style={{ color: "#637381", fontSize: "12px" }}>Model Accuracy (R²)</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: latestResults.summary.r2 >= 0.8 ? "#108043" : "#EEC200" }}>
                        {latestResults.summary.r2}
                      </div>
                    </div>
                  </div>

                  {/* Top Channels */}
                  <s-text variant="headingSm">Channel Contribution</s-text>
                  <div style={{ marginTop: "12px" }}>
                    {latestResults.channels.slice(0, 5).map((ch: any, i: number) => (
                      <div key={ch.channel} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < latestResults.channels.length - 1 ? "1px solid #F1F1F1" : "none" }}>
                        <span style={{ width: "24px", textAlign: "center", color: "#637381", fontSize: "12px" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 500 }}>{ch.label}</span>
                        <span style={{ color: "#637381", fontSize: "13px" }}>{formatCurrency(ch.contribution)}</span>
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
                <s-text variant="headingMd">Getting Started</s-text>
                <s-box padding-block-start="300">
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {[
                      { step: 1, done: hasData, label: "Prepare your data", desc: "Sync Shopify data and upload ad spend via Excel", link: "/app/data", btnLabel: "Go to Data Setup", showBtn: !hasData },
                      { step: 2, done: hasAnalysis, label: "Run analysis", desc: "Run MMM to calculate channel contribution, ROAS, and saturation curves", link: "/app/analysis", btnLabel: "Go to Analysis", showBtn: hasData && !hasAnalysis },
                      { step: 3, done: false, label: "Review results", desc: "Review contribution charts, saturation curves, and optimal budget allocation", link: "", btnLabel: "", showBtn: false },
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
                <s-text variant="headingMd">Analysis History</s-text>
                <s-box padding-block-start="200">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                        <th style={{ textAlign: "left", padding: "8px" }}>ID</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Created</th>
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
                            {new Date(analysis.createdAt).toLocaleString("en-US")}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            {analysis.status === "COMPLETED" && (
                              <s-button size="slim" variant="plain" onClick={() => navigate(`/app/results/${analysis.id}`)}>
                                View Results
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

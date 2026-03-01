import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";
import { ensureShop } from "../services/shop.server";
import { getPlanFeatures, normalizePlan } from "../services/billing.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const analysisId = params.id;

  if (!analysisId) {
    throw new Response("Analysis ID is required", { status: 400 });
  }

  const shopRecord = await ensureShop(shop);

  const analysis = await db.analysis.findFirst({
    where: {
      id: analysisId,
      shop: { shopDomain: shop },
    },
  });

  if (!analysis) {
    throw new Response("Analysis not found", { status: 404 });
  }

  const results = analysis.results ? JSON.parse(analysis.results) : null;
  const config = JSON.parse(analysis.config);
  const plan = normalizePlan(shopRecord.plan);
  const features = getPlanFeatures(plan);

  return { analysis, results, config, plan, features };
};

type Tab = "contribution" | "saturation" | "budget" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "contribution", label: "Channel Contribution" },
  { id: "saturation", label: "Saturation & Marginal ROI" },
  { id: "budget", label: "Budget Optimization" },
  { id: "accuracy", label: "Model Accuracy" },
];

const COLORS = ["#5C6AC4", "#007ACE", "#00A0AC", "#108043", "#EEC200", "#DE3618"];

function formatCurrency(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function Results() {
  const { analysis, results, config, plan, features } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("contribution");

  if (analysis.status !== "COMPLETED" || !results) {
    return (
      <s-page
        title={`Analysis #${analysis.id.slice(0, 8)}`}
        backAction={{ url: "/app/analysis" }}
      >
        <s-layout>
          <s-layout-section>
            <s-card>
              <s-box padding="400">
                {analysis.status === "RUNNING" ? (
                  <>
                    <s-text variant="headingMd">Analysis in progress...</s-text>
                    <s-box padding-block-start="400">
                      <s-spinner size="large" />
                    </s-box>
                  </>
                ) : analysis.status === "FAILED" ? (
                  <>
                    <s-text variant="headingMd">Analysis failed</s-text>
                    <s-box padding-block-start="200">
                      <s-banner tone="critical">
                        {analysis.errorMsg || "Unknown error"}
                      </s-banner>
                    </s-box>
                  </>
                ) : (
                  <s-text variant="headingMd">Analysis pending</s-text>
                )}
              </s-box>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-page>
    );
  }

  const { summary, channels, budgetOptimization } = results;

  const handleDownload = () => {
    fetch(`/api/results/${analysis.id}/download`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mmm-report-${analysis.id.slice(0, 8)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch((err) => console.error("Download error:", err));
  };

  return (
    <s-page
      title={`Analysis Results #${analysis.id.slice(0, 8)}`}
      subtitle={`${summary.dateRange.start} - ${summary.dateRange.end} (${summary.dataPoints} days)`}
      backAction={{ url: "/app/analysis" }}
    >
      {/* Download Button */}
      <s-layout>
        <s-layout-section fullWidth>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px", gap: "8px", alignItems: "center" }}>
            {features.excelExport ? (
              <s-button onClick={handleDownload}>Download Excel Report</s-button>
            ) : (
              <s-button disabled onClick={() => navigate("/app/plans")}>
                Download Excel Report (Starter+)
              </s-button>
            )}
          </div>
        </s-layout-section>
      </s-layout>

      {/* Summary Cards */}
      <s-layout>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">Total Revenue</s-text>
              <s-text variant="headingLg">{formatCurrency(summary.totalRevenue)}</s-text>
            </s-box>
          </s-card>
        </s-layout-section>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">Total Ad Spend</s-text>
              <s-text variant="headingLg">{formatCurrency(summary.totalSpend)}</s-text>
            </s-box>
          </s-card>
        </s-layout-section>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">Overall ROAS</s-text>
              <s-text variant="headingLg">{summary.overallRoas}x</s-text>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>

      {/* Tab Navigation */}
      <s-layout>
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="200">
              <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderBottom: activeTab === tab.id ? "3px solid #5C6AC4" : "3px solid transparent",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      fontWeight: activeTab === tab.id ? 600 : 400,
                      color: activeTab === tab.id ? "#202223" : "#637381",
                      whiteSpace: "nowrap",
                      fontSize: "14px",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Tab Content */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              {activeTab === "contribution" && (
                <div>
                  <s-text variant="headingMd">Channel Contribution</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodySm" tone="subdued">
                      Base revenue (non-ad): {formatCurrency(summary.baseRevenue)} ({summary.basePct}%)
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    {channels.map((ch: any, i: number) => (
                      <div key={ch.channel} style={{ marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 500 }}>{ch.label}</span>
                          <span>{ch.contributionPct}% / ROAS {ch.roas}x</span>
                        </div>
                        <div style={{ background: "#f1f1f1", borderRadius: "4px", height: "24px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(ch.contributionPct * 2, 100)}%`,
                              height: "100%",
                              backgroundColor: COLORS[i % COLORS.length],
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              paddingLeft: "8px",
                              color: "#fff",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {formatCurrency(ch.contribution)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </s-box>

                  {/* Detail Table — Starter+ only */}
                  <s-box padding-block-start="400">
                    {features.channelDetails ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                            <th style={{ textAlign: "left", padding: "8px" }}>Channel</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>Revenue Contribution</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>Ad Spend</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>ROAS</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>CPA</th>
                            <th style={{ textAlign: "right", padding: "8px" }}>Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {channels.map((ch: any, i: number) => (
                            <tr key={ch.channel} style={{ borderBottom: "1px solid #e1e3e5" }}>
                              <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[i % COLORS.length] }} />
                                {ch.label}
                              </td>
                              <td style={{ textAlign: "right", padding: "8px" }}>{formatCurrency(ch.contribution)}</td>
                              <td style={{ textAlign: "right", padding: "8px" }}>{formatCurrency(ch.totalSpend)}</td>
                              <td style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: ch.roas >= 3 ? "#108043" : ch.roas >= 1 ? "#202223" : "#DE3618" }}>{ch.roas}x</td>
                              <td style={{ textAlign: "right", padding: "8px" }}>{formatCurrency(ch.cpa)}</td>
                              <td style={{ textAlign: "right", padding: "8px" }}>{ch.contributionPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <s-card>
                        <s-box padding="400">
                          <div style={{ textAlign: "center" }}>
                            <s-text variant="bodyMd" tone="subdued">
                              Detailed channel breakdown with Ad Spend, ROAS, CPA, and Share is available on the Starter plan.
                            </s-text>
                            <s-box padding-block-start="300">
                              <s-button onClick={() => navigate("/app/plans")}>Upgrade to Starter</s-button>
                            </s-box>
                          </div>
                        </s-box>
                      </s-card>
                    )}
                  </s-box>
                </div>
              )}

              {activeTab === "saturation" && !features.saturationAnalysis && (
                <div>
                  <s-text variant="headingMd">Saturation & Marginal ROI</s-text>
                  <s-box padding-block-start="400">
                    <s-card>
                      <s-box padding="600">
                        <div style={{ textAlign: "center" }}>
                          <s-text variant="headingMd">Pro Feature</s-text>
                          <s-box padding-block-start="200">
                            <s-text variant="bodyMd" tone="subdued">
                              Upgrade to Pro to access saturation analysis and marginal ROI insights.
                            </s-text>
                          </s-box>
                          <s-box padding-block-start="400">
                            <s-button variant="primary" onClick={() => navigate("/app/plans")}>
                              Upgrade to Pro
                            </s-button>
                          </s-box>
                        </div>
                      </s-box>
                    </s-card>
                  </s-box>
                </div>
              )}

              {activeTab === "saturation" && features.saturationAnalysis && (
                <div>
                  <s-text variant="headingMd">Saturation & Marginal ROI</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodySm" tone="subdued">
                      Highly saturated channels have diminishing returns on additional investment. Consider increasing spend on channels with higher marginal ROI.
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>Channel</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Saturation</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>Level</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Marginal ROI</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Current ROAS</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch: any, i: number) => (
                          <tr key={ch.channel} style={{ borderBottom: "1px solid #e1e3e5" }}>
                            <td style={{ padding: "8px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[i % COLORS.length] }} />
                                {ch.label}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{ch.saturationPct}%</td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              <div style={{ background: "#f1f1f1", borderRadius: "4px", height: "16px", overflow: "hidden", width: "100px", display: "inline-block" }}>
                                <div style={{
                                  width: `${ch.saturationPct}%`,
                                  height: "100%",
                                  backgroundColor: ch.saturationPct > 80 ? "#DE3618" : ch.saturationPct > 60 ? "#EEC200" : "#108043",
                                  borderRadius: "4px",
                                }} />
                              </div>
                            </td>
                            <td style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>{ch.marginalRoi}x</td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{ch.roas}x</td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              {ch.saturationPct > 80 ? (
                                <span style={{ color: "#DE3618", fontWeight: 600 }}>Reduce</span>
                              ) : ch.saturationPct > 60 ? (
                                <span style={{ color: "#EEC200", fontWeight: 600 }}>Maintain</span>
                              ) : (
                                <span style={{ color: "#108043", fontWeight: 600 }}>Increase</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </s-box>
                </div>
              )}

              {activeTab === "budget" && !features.budgetOptimization && (
                <div>
                  <s-text variant="headingMd">Budget Optimization</s-text>
                  <s-box padding-block-start="400">
                    <s-card>
                      <s-box padding="600">
                        <div style={{ textAlign: "center" }}>
                          <s-text variant="headingMd">Pro Feature</s-text>
                          <s-box padding-block-start="200">
                            <s-text variant="bodyMd" tone="subdued">
                              Upgrade to Pro to access AI-powered budget optimization recommendations.
                            </s-text>
                          </s-box>
                          <s-box padding-block-start="400">
                            <s-button variant="primary" onClick={() => navigate("/app/plans")}>
                              Upgrade to Pro
                            </s-button>
                          </s-box>
                        </div>
                      </s-box>
                    </s-card>
                  </s-box>
                </div>
              )}

              {activeTab === "budget" && features.budgetOptimization && budgetOptimization && (
                <div>
                  <s-text variant="headingMd">Budget Optimization</s-text>
                  <s-box padding-block-start="200">
                    <s-banner tone="success">
                      Optimization could deliver an estimated +{budgetOptimization.expectedLift}% revenue lift (same total budget)
                    </s-banner>
                  </s-box>
                  <s-box padding-block-start="400">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>Channel</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Current Budget</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>→</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Recommended</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch: any, i: number) => {
                          const current = budgetOptimization.currentSpend[ch.channel] || 0;
                          const optimal = budgetOptimization.optimizedSpend[ch.channel] || 0;
                          const diff = optimal - current;
                          const diffPct = current > 0 ? Math.round((diff / current) * 100) : 0;
                          return (
                            <tr key={ch.channel} style={{ borderBottom: "1px solid #e1e3e5" }}>
                              <td style={{ padding: "8px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[i % COLORS.length] }} />
                                  {ch.label}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", padding: "8px" }}>{formatCurrency(current)}</td>
                              <td style={{ textAlign: "center", padding: "8px" }}>→</td>
                              <td style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>{formatCurrency(optimal)}</td>
                              <td style={{ textAlign: "right", padding: "8px", color: diff > 0 ? "#108043" : diff < 0 ? "#DE3618" : "#637381", fontWeight: 600 }}>
                                {diff > 0 ? "+" : ""}{diffPct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </s-box>
                </div>
              )}

              {activeTab === "accuracy" && (
                <div>
                  <s-text variant="headingMd">Model Accuracy</s-text>
                  <s-box padding-block-start="400">
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>R² (Coefficient of Determination)</div>
                        <div style={{ fontSize: "32px", fontWeight: 700, color: summary.r2 >= 0.8 ? "#108043" : "#EEC200" }}>
                          {summary.r2}
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          {summary.r2 >= 0.9 ? "Excellent" : summary.r2 >= 0.8 ? "Good" : "Needs improvement"}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>MAPE (Mean Absolute % Error)</div>
                        <div style={{ fontSize: "32px", fontWeight: 700, color: summary.mape <= 10 ? "#108043" : "#EEC200" }}>
                          {summary.mape}%
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          {summary.mape <= 10 ? "High accuracy" : summary.mape <= 15 ? "Good" : "Needs improvement"}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>Base Revenue Ratio</div>
                        <div style={{ fontSize: "32px", fontWeight: 700 }}>
                          {summary.basePct}%
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          Revenue from non-ad sources (brand, organic, etc.)
                        </div>
                      </div>
                    </div>
                  </s-box>
                </div>
              )}
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

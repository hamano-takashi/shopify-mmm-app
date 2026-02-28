import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const analysisId = params.id;

  if (!analysisId) {
    throw new Response("Analysis ID is required", { status: 400 });
  }

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

  return { analysis, results, config };
};

type Tab = "contribution" | "saturation" | "budget" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "contribution", label: "チャネル貢献度" },
  { id: "saturation", label: "飽和度・限界ROI" },
  { id: "budget", label: "予算最適化" },
  { id: "accuracy", label: "モデル精度" },
];

const COLORS = ["#5C6AC4", "#007ACE", "#00A0AC", "#108043", "#EEC200", "#DE3618"];

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

export default function Results() {
  const { analysis, results, config } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<Tab>("contribution");

  if (analysis.status !== "COMPLETED" || !results) {
    return (
      <s-page
        title={`分析 #${analysis.id.slice(0, 8)}`}
        backAction={{ url: "/app/analysis" }}
      >
        <s-layout>
          <s-layout-section>
            <s-card>
              <s-box padding="400">
                {analysis.status === "RUNNING" ? (
                  <>
                    <s-text variant="headingMd">分析実行中...</s-text>
                    <s-box padding-block-start="400">
                      <s-spinner size="large" />
                    </s-box>
                  </>
                ) : analysis.status === "FAILED" ? (
                  <>
                    <s-text variant="headingMd">分析に失敗しました</s-text>
                    <s-box padding-block-start="200">
                      <s-banner tone="critical">
                        {analysis.errorMsg || "不明なエラー"}
                      </s-banner>
                    </s-box>
                  </>
                ) : (
                  <s-text variant="headingMd">分析待機中</s-text>
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
      title={`分析結果 #${analysis.id.slice(0, 8)}`}
      subtitle={`${summary.dateRange.start} 〜 ${summary.dateRange.end}（${summary.dataPoints}日分）`}
      backAction={{ url: "/app/analysis" }}
    >
      {/* Download Button */}
      <s-layout>
        <s-layout-section fullWidth>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
            <s-button onClick={handleDownload}>Excelレポートをダウンロード</s-button>
          </div>
        </s-layout-section>
      </s-layout>

      {/* Summary Cards */}
      <s-layout>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">総売上</s-text>
              <s-text variant="headingLg">{formatYen(summary.totalRevenue)}</s-text>
            </s-box>
          </s-card>
        </s-layout-section>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">総広告費</s-text>
              <s-text variant="headingLg">{formatYen(summary.totalSpend)}</s-text>
            </s-box>
          </s-card>
        </s-layout-section>
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">総合ROAS</s-text>
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
                  <s-text variant="headingMd">チャネル貢献度</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodySm" tone="subdued">
                      ベース売上（広告以外）: {formatYen(summary.baseRevenue)}（{summary.basePct}%）
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    {/* Bar visualization */}
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
                            {formatYen(ch.contribution)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </s-box>

                  {/* Detail Table */}
                  <s-box padding-block-start="400">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>チャネル</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>貢献売上</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>広告費</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>ROAS</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>CPA</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>貢献度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch: any, i: number) => (
                          <tr key={ch.channel} style={{ borderBottom: "1px solid #e1e3e5" }}>
                            <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", backgroundColor: COLORS[i % COLORS.length] }} />
                              {ch.label}
                            </td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{formatYen(ch.contribution)}</td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{formatYen(ch.totalSpend)}</td>
                            <td style={{ textAlign: "right", padding: "8px", fontWeight: 600, color: ch.roas >= 3 ? "#108043" : ch.roas >= 1 ? "#202223" : "#DE3618" }}>{ch.roas}x</td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{formatYen(ch.cpa)}</td>
                            <td style={{ textAlign: "right", padding: "8px" }}>{ch.contributionPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </s-box>
                </div>
              )}

              {activeTab === "saturation" && (
                <div>
                  <s-text variant="headingMd">飽和度・限界ROI</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodySm" tone="subdued">
                      飽和度が高いチャネルは追加投資の効果が薄れています。限界ROIが高いチャネルへの増額を検討してください。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>チャネル</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>飽和度</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>飽和状況</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>限界ROI</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>現在ROAS</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>判定</th>
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
                                <span style={{ color: "#DE3618", fontWeight: 600 }}>要減額</span>
                              ) : ch.saturationPct > 60 ? (
                                <span style={{ color: "#EEC200", fontWeight: 600 }}>維持</span>
                              ) : (
                                <span style={{ color: "#108043", fontWeight: 600 }}>増額余地</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </s-box>
                </div>
              )}

              {activeTab === "budget" && budgetOptimization && (
                <div>
                  <s-text variant="headingMd">予算配分の最適化</s-text>
                  <s-box padding-block-start="200">
                    <s-banner tone="success">
                      最適化により推定 +{budgetOptimization.expectedLift}% の売上リフトが見込めます（総予算は同額）
                    </s-banner>
                  </s-box>
                  <s-box padding-block-start="400">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>チャネル</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>現在予算</th>
                          <th style={{ textAlign: "center", padding: "8px" }}>→</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>推奨予算</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>変動</th>
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
                              <td style={{ textAlign: "right", padding: "8px" }}>{formatYen(current)}</td>
                              <td style={{ textAlign: "center", padding: "8px" }}>→</td>
                              <td style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>{formatYen(optimal)}</td>
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
                  <s-text variant="headingMd">モデル精度</s-text>
                  <s-box padding-block-start="400">
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>R²（決定係数）</div>
                        <div style={{ fontSize: "32px", fontWeight: 700, color: summary.r2 >= 0.8 ? "#108043" : "#EEC200" }}>
                          {summary.r2}
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          {summary.r2 >= 0.9 ? "非常に良好" : summary.r2 >= 0.8 ? "良好" : "改善の余地あり"}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>MAPE（平均絶対誤差率）</div>
                        <div style={{ fontSize: "32px", fontWeight: 700, color: summary.mape <= 10 ? "#108043" : "#EEC200" }}>
                          {summary.mape}%
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          {summary.mape <= 10 ? "高精度" : summary.mape <= 15 ? "良好" : "改善の余地あり"}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: "200px", padding: "16px", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                        <div style={{ color: "#637381", fontSize: "12px", marginBottom: "4px" }}>ベース売上比率</div>
                        <div style={{ fontSize: "32px", fontWeight: 700 }}>
                          {summary.basePct}%
                        </div>
                        <div style={{ fontSize: "12px", color: "#637381", marginTop: "4px" }}>
                          広告以外の売上（ブランド力・自然検索等）
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

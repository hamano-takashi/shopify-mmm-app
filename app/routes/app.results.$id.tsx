import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState } from "react";
import { ContributionChart } from "../components/results/ContributionChart";
import { SaturationCurve } from "../components/results/SaturationCurve";
import { BudgetAllocation } from "../components/results/BudgetAllocation";
import { ModelAccuracy } from "../components/results/ModelAccuracy";

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

type Tab = "contribution" | "saturation" | "budget" | "accuracy" | "download";

const TABS: { id: Tab; label: string }[] = [
  { id: "contribution", label: "チャネル貢献度" },
  { id: "saturation", label: "飽和曲線" },
  { id: "budget", label: "予算配分" },
  { id: "accuracy", label: "モデル精度" },
  { id: "download", label: "ダウンロード" },
];

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
                    <s-box padding-block-start="200">
                      <s-text variant="bodyMd" tone="subdued">
                        分析が完了するまでお待ちください。通常5〜15分かかります。
                      </s-text>
                    </s-box>
                    <s-box padding-block-start="400">
                      <s-spinner size="large" />
                    </s-box>
                  </>
                ) : analysis.status === "FAILED" ? (
                  <>
                    <s-text variant="headingMd">分析に失敗しました</s-text>
                    <s-box padding-block-start="200">
                      <s-banner tone="critical">
                        {analysis.errorMsg || "不明なエラーが発生しました"}
                      </s-banner>
                    </s-box>
                  </>
                ) : (
                  <>
                    <s-text variant="headingMd">分析待機中</s-text>
                    <s-box padding-block-start="200">
                      <s-text variant="bodyMd" tone="subdued">
                        分析がキューに入っています。まもなく開始されます。
                      </s-text>
                    </s-box>
                  </>
                )}
              </s-box>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-page>
    );
  }

  return (
    <s-page
      title={`分析結果 #${analysis.id.slice(0, 8)}`}
      subtitle={`実行日: ${new Date(analysis.createdAt).toLocaleString("ja-JP")}`}
      backAction={{ url: "/app/analysis" }}
    >
      <s-layout>
        {/* Tab navigation */}
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

        {/* Tab content */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              {activeTab === "contribution" && results.contribution && (
                <div>
                  <s-text variant="headingMd">チャネル貢献度</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      各マーケティングチャネルの売上への貢献度とROASを表示します。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <ContributionChart channels={results.contribution.channels} />
                  </s-box>
                </div>
              )}

              {activeTab === "saturation" && results.saturation && (
                <div>
                  <s-text variant="headingMd">飽和曲線</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      チャネルごとの投資効率の逓減を可視化します。
                      曲線が平らになるほど、追加投資の効果が薄れています。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <SaturationCurve saturation={results.saturation} />
                  </s-box>
                </div>
              )}

              {activeTab === "budget" && results.budget && (
                <div>
                  <s-text variant="headingMd">予算配分の最適化</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      現在の予算配分と、モデルが推奨する最適配分を比較します。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <BudgetAllocation
                      current={results.budget.current}
                      optimal={results.budget.optimal}
                    />
                  </s-box>
                </div>
              )}

              {activeTab === "accuracy" && results.accuracy && (
                <div>
                  <s-text variant="headingMd">モデル精度</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      モデルの適合度指標を表示します。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <ModelAccuracy
                      r_squared={results.accuracy.r_squared}
                      mape={results.accuracy.mape}
                      actual_vs_predicted={results.accuracy.actual_vs_predicted}
                    />
                  </s-box>
                </div>
              )}

              {activeTab === "download" && (
                <div>
                  <s-text variant="headingMd">レポートダウンロード</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      分析結果をファイルとしてダウンロードできます。
                    </s-text>
                  </s-box>
                  <s-box padding-block-start="400">
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <a
                        href={`/api/results/${analysis.id}/download?format=csv`}
                        download
                        style={{ textDecoration: "none" }}
                      >
                        <s-button>CSV ダウンロード</s-button>
                      </a>
                      <a
                        href={`/api/results/${analysis.id}/download?format=json`}
                        download
                        style={{ textDecoration: "none" }}
                      >
                        <s-button>JSON ダウンロード</s-button>
                      </a>
                    </div>
                  </s-box>

                  {/* Config summary */}
                  <s-box padding-block-start="400">
                    <s-text variant="headingSm">分析設定</s-text>
                    <s-box padding-block-start="200">
                      <table style={{ borderCollapse: "collapse" }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>目的変数</td>
                            <td style={{ padding: "4px 0" }}>{config.dep_var || "net_sales"}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>データ期間</td>
                            <td style={{ padding: "4px 0" }}>{config.date_range || "180d"}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>MCMCチェーン数</td>
                            <td style={{ padding: "4px 0" }}>{config.chains || 4}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Tuneサンプル数</td>
                            <td style={{ padding: "4px 0" }}>{config.tune || 1000}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Drawサンプル数</td>
                            <td style={{ padding: "4px 0" }}>{config.draws || 500}</td>
                          </tr>
                        </tbody>
                      </table>
                    </s-box>
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

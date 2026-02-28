import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
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

  const completedCount = analyses.filter((a) => a.status === "COMPLETED").length;
  const latestCompleted = analyses.find((a) => a.status === "COMPLETED");

  return {
    shopDomain,
    analyses,
    dataSourceCount,
    dailyDataCount,
    completedCount,
    latestCompleted,
  };
};

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
    shopDomain,
    analyses,
    dataSourceCount,
    dailyDataCount,
    completedCount,
    latestCompleted,
  } = useLoaderData<typeof loader>();

  const hasData = dataSourceCount > 0 || dailyDataCount > 0;
  const hasAnalysis = completedCount > 0;

  // Determine onboarding step
  let currentStep = 1;
  if (hasData) currentStep = 2;
  if (hasAnalysis) currentStep = 3;

  return (
    <s-page title="ダッシュボード">
      <s-layout>
        {/* Welcome + Quick Status */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingLg">MMM Analytics</s-text>
              <s-box padding-block-start="100">
                <s-text variant="bodyMd" tone="subdued">
                  マーケティング・ミックス・モデリングで、各チャネルの真の貢献度を把握し、
                  予算配分を最適化しましょう。
                </s-text>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* KPI Cards */}
        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">データポイント</s-text>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{dailyDataCount}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">日分のデータ</s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="bodySm" tone="subdued">データソース</s-text>
              <s-box padding-block-start="100">
                <s-text variant="headingXl">{dataSourceCount}</s-text>
              </s-box>
              <s-text variant="bodySm" tone="subdued">接続済み</s-text>
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
              <s-text variant="bodySm" tone="subdued">回</s-text>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Getting Started Guide */}
        {!hasAnalysis && (
          <s-layout-section fullWidth>
            <s-card>
              <s-box padding="400">
                <s-text variant="headingMd">はじめかた</s-text>
                <s-box padding-block-start="300">
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Step 1 */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: currentStep >= 1 ? "#5C6AC4" : "#DFE3E8",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: "13px",
                          flexShrink: 0,
                        }}
                      >
                        {hasData ? "\u2713" : "1"}
                      </div>
                      <div>
                        <s-text variant="bodyMd" fontWeight="semibold">
                          データを準備する
                        </s-text>
                        <s-text variant="bodySm" tone="subdued">
                          Shopifyデータの同期と、広告データのExcelアップロードを行います。
                        </s-text>
                        {!hasData && (
                          <s-box padding-block-start="200">
                            <a href="/app/data" style={{ textDecoration: "none" }}>
                              <s-button variant="primary" size="slim">
                                データ準備へ
                              </s-button>
                            </a>
                          </s-box>
                        )}
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: currentStep >= 2 ? "#5C6AC4" : "#DFE3E8",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: "13px",
                          flexShrink: 0,
                        }}
                      >
                        {hasAnalysis ? "\u2713" : "2"}
                      </div>
                      <div>
                        <s-text variant="bodyMd" fontWeight="semibold">
                          分析を実行する
                        </s-text>
                        <s-text variant="bodySm" tone="subdued">
                          MMMを実行して、チャネルごとの貢献度・ROAS・飽和曲線を算出します。（5〜15分）
                        </s-text>
                        {hasData && !hasAnalysis && (
                          <s-box padding-block-start="200">
                            <a href="/app/analysis" style={{ textDecoration: "none" }}>
                              <s-button variant="primary" size="slim">
                                分析実行へ
                              </s-button>
                            </a>
                          </s-box>
                        )}
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: "#DFE3E8",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: "13px",
                          flexShrink: 0,
                        }}
                      >
                        3
                      </div>
                      <div>
                        <s-text variant="bodyMd" fontWeight="semibold">
                          結果を確認する
                        </s-text>
                        <s-text variant="bodySm" tone="subdued">
                          貢献度チャート・飽和曲線・最適予算配分を確認し、次の施策に活かします。
                        </s-text>
                      </div>
                    </div>
                  </div>
                </s-box>
              </s-box>
            </s-card>
          </s-layout-section>
        )}

        {/* Latest Result Quick View */}
        {latestCompleted && (
          <s-layout-section fullWidth>
            <s-card>
              <s-box padding="400">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <s-text variant="headingMd">最新の分析結果</s-text>
                  <a href={`/app/results/${latestCompleted.id}`} style={{ textDecoration: "none" }}>
                    <s-button size="slim">詳細を見る</s-button>
                  </a>
                </div>
                <s-box padding-block-start="200">
                  <s-text variant="bodySm" tone="subdued">
                    分析 #{latestCompleted.id.slice(0, 8)} |{" "}
                    {new Date(latestCompleted.createdAt).toLocaleString("ja-JP")}
                  </s-text>
                </s-box>
              </s-box>
            </s-card>
          </s-layout-section>
        )}

        {/* Recent Analyses */}
        {analyses.length > 0 && (
          <s-layout-section fullWidth>
            <s-card>
              <s-box padding="400">
                <s-text variant="headingMd">分析履歴</s-text>
                <s-box padding-block-start="200">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                          <td style={{ padding: "8px", fontFamily: "monospace" }}>
                            #{analysis.id.slice(0, 8)}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <span
                              style={{
                                color: getStatusColor(analysis.status),
                                fontWeight: 600,
                              }}
                            >
                              {getStatusLabel(analysis.status)}
                            </span>
                          </td>
                          <td style={{ padding: "8px", color: "#637381" }}>
                            {new Date(analysis.createdAt).toLocaleString("ja-JP")}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            {analysis.status === "COMPLETED" && (
                              <a
                                href={`/app/results/${analysis.id}`}
                                style={{ color: "#5C6AC4", textDecoration: "none" }}
                              >
                                結果を見る
                              </a>
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

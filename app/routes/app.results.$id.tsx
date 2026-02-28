import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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

export default function Results() {
  const { analysis, results, config } = useLoaderData<typeof loader>();

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
      backAction={{ url: "/app/analysis" }}
    >
      <s-layout>
        {/* Tab 1: Channel Contribution */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">チャネル貢献度</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  各マーケティングチャネルの売上への貢献度を表示します。
                </s-text>
                {/* TODO: Phase 3 - Recharts ContributionChart component */}
                <s-box padding-block-start="400">
                  <s-text variant="bodyMd">
                    (チャート表示はPhase 3で実装)
                  </s-text>
                </s-box>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Tab 2: Saturation Curves */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">飽和曲線</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  チャネルごとの投資効率の逓減を可視化します。
                </s-text>
                {/* TODO: Phase 3 - Recharts SaturationCurve component */}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Tab 3: Budget Allocation */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">予算配分</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  現在の予算配分と最適化後の予算配分を比較します。
                </s-text>
                {/* TODO: Phase 3 - Recharts BudgetAllocation component */}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Tab 4: Model Accuracy */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">モデル精度</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  モデルの適合度指標を表示します。
                </s-text>
                {results.r_squared && (
                  <s-box padding-block-start="400">
                    <s-text variant="headingLg">
                      R² = {(results.r_squared * 100).toFixed(1)}%
                    </s-text>
                  </s-box>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Tab 5: Download */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">レポートダウンロード</s-text>
              <s-box padding-block-start="200">
                <s-button-group>
                  <s-button>CSV</s-button>
                  <s-button>Excel</s-button>
                  <s-button>PDF</s-button>
                </s-button-group>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

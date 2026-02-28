import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { exportMergedDataAsCSV } from "../services/data-merger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // Check if shop has data
  const dataSourceCount = await db.dataSource.count({
    where: { shopId: shop.id },
  });

  // Get running/recent analyses
  const analyses = await db.analysis.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return { shopDomain: session.shop, dataSourceCount, analyses };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "start_analysis") {
    const shop = await ensureShop(session.shop);

    // Verify data exists
    const dataCount = await db.dataSource.count({
      where: { shopId: shop.id },
    });

    if (dataCount === 0) {
      return { success: false, message: "データが登録されていません。先にデータ準備を行ってください。" };
    }

    // Dispatch analysis job via BullMQ
    const { startAnalysis } = await import("../services/analysis-runner.server");
    const result = await startAnalysis(shop.id, {
      dep_var: "net_sales",
      date_range: "180d",
    });

    return {
      success: result.success,
      message: result.message,
      analysisId: result.analysisId,
    };
  }

  return { success: false, message: "不明なアクションです" };
};

function getStatusBadgeTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "RUNNING":
      return "attention";
    case "FAILED":
      return "critical";
    default:
      return "info";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "待機中";
    case "RUNNING":
      return "実行中";
    case "COMPLETED":
      return "完了";
    case "FAILED":
      return "失敗";
    default:
      return status;
  }
}

export default function Analysis() {
  const { dataSourceCount, analyses } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const hasData = dataSourceCount > 0;

  return (
    <s-page
      title="分析実行"
      subtitle="Marketing Mix Modelingを実行して、チャネル貢献度を分析"
    >
      {actionData?.message && (
        <s-banner
          tone={actionData.success ? "success" : "critical"}
          onDismiss={() => {}}
        >
          {actionData.message}
        </s-banner>
      )}

      <s-layout>
        {/* Analysis Launch */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">新しい分析を開始</s-text>
              <s-box padding-block-start="200">
                {!hasData ? (
                  <s-text variant="bodyMd" tone="subdued">
                    分析を開始するには、まず「データ準備」ページでデータを登録してください。
                  </s-text>
                ) : (
                  <>
                    <s-text variant="bodyMd" tone="subdued">
                      登録済みデータを使ってMMMを実行します。
                      分析には5〜15分程度かかります。
                    </s-text>
                    <s-box padding-block-start="400">
                      <form method="post">
                        <input type="hidden" name="intent" value="start_analysis" />
                        <s-button
                          variant="primary"
                          type="submit"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "作成中..." : "分析を開始"}
                        </s-button>
                      </form>
                    </s-box>
                  </>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Analysis History */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">分析履歴</s-text>
              <s-box padding-block-start="200">
                {analyses.length === 0 ? (
                  <s-text variant="bodyMd" tone="subdued">
                    まだ分析が実行されていません。
                  </s-text>
                ) : (
                  <s-resource-list>
                    {analyses.map((analysis) => (
                      <s-resource-item
                        key={analysis.id}
                        url={
                          analysis.status === "COMPLETED"
                            ? `/app/results/${analysis.id}`
                            : undefined
                        }
                      >
                        <s-inline>
                          <s-text variant="bodyMd">
                            分析 #{analysis.id.slice(0, 8)}
                          </s-text>
                          <s-badge tone={getStatusBadgeTone(analysis.status)}>
                            {getStatusLabel(analysis.status)}
                          </s-badge>
                        </s-inline>
                        <s-text variant="bodySm" tone="subdued">
                          {new Date(analysis.createdAt).toLocaleString("ja-JP")}
                        </s-text>
                      </s-resource-item>
                    ))}
                  </s-resource-list>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

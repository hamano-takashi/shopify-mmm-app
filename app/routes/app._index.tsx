import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Ensure shop record exists on every load
  const shop = await ensureShop(shopDomain);

  // Get recent analyses
  const analyses = await db.analysis.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Get data source count
  const dataSourceCount = await db.dataSource.count({
    where: { shopId: shop.id },
  });

  return { shopDomain, analyses, dataSourceCount };
};

export default function Dashboard() {
  const { shopDomain, analyses, dataSourceCount } = useLoaderData<typeof loader>();

  return (
    <s-page title="ダッシュボード">
      <s-layout>
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">MMM Analytics</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  マーケティング・ミックス・モデリングで、各チャネルの真の貢献度を把握し、
                  予算配分を最適化しましょう。
                </s-text>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">データソース</s-text>
              <s-box padding-block-start="200">
                <s-text variant="headingLg">{dataSourceCount}</s-text>
                <s-text variant="bodyMd" tone="subdued">接続済み</s-text>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section variant="oneThird">
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">分析履歴</s-text>
              <s-box padding-block-start="200">
                <s-text variant="headingLg">{analyses.length}</s-text>
                <s-text variant="bodyMd" tone="subdued">実行済み</s-text>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">最近の分析</s-text>
              <s-box padding-block-start="200">
                {analyses.length === 0 ? (
                  <s-empty-state
                    heading="まだ分析がありません"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <s-text variant="bodyMd">
                      「データ準備」からデータを登録し、「分析実行」で最初のMMMを実行してください。
                    </s-text>
                  </s-empty-state>
                ) : (
                  <s-resource-list>
                    {analyses.map((analysis) => (
                      <s-resource-item
                        key={analysis.id}
                        url={`/app/results/${analysis.id}`}
                      >
                        <s-text variant="bodyMd">
                          分析 #{analysis.id.slice(0, 8)}
                        </s-text>
                        <s-text variant="bodyMd" tone="subdued">
                          ステータス: {analysis.status} | 作成日:{" "}
                          {new Date(analysis.createdAt).toLocaleDateString("ja-JP")}
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

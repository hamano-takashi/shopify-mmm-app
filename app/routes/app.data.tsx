import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const dataSources = await db.dataSource.findMany({
    where: { shop: { shopDomain: shop } },
    orderBy: { createdAt: "desc" },
  });

  return { shop, dataSources };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "sync_shopify") {
    // TODO: Phase 2 - ShopifyQL data sync
    return { success: true, message: "Shopifyデータの同期を開始しました" };
  }

  if (intent === "upload_excel") {
    // TODO: Phase 3 - Excel upload & validation
    return { success: true, message: "Excelファイルを処理中です" };
  }

  return { success: false, message: "不明なアクションです" };
};

export default function DataPrep() {
  const { shop, dataSources } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page
      title="データ準備"
      subtitle="Shopifyデータの自動取得と外部データのアップロード"
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
        {/* Step 1: Shopify Auto Sync */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 1: Shopifyデータ（自動取得）</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  ShopifyQLを使って売上・セッション・顧客データを自動取得します。
                  過去180日分のデータが対象です。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <form method="post">
                  <input type="hidden" name="intent" value="sync_shopify" />
                  <s-button variant="primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "同期中..." : "Shopifyデータを同期"}
                  </s-button>
                </form>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 2: Excel Upload */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 2: 外部データ（Excelアップロード）</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  Google Ads、Meta Ads、LINE広告などの外部チャネルデータを
                  Excelテンプレートに入力してアップロードしてください。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <s-button-group>
                  <s-button>テンプレートをダウンロード</s-button>
                  <s-button variant="primary">Excelをアップロード</s-button>
                </s-button-group>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 3: Channel Config */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 3: チャネル変数設定</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  分析に含めるチャネルと変数を選択してください。
                  Impression、Click、Costから選択できます。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <s-text variant="bodyMd" tone="subdued">
                  (データ同期後に設定可能になります)
                </s-text>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 4: Data Preview */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 4: データプレビュー</s-text>
              <s-box padding-block-start="200">
                {dataSources.length === 0 ? (
                  <s-text variant="bodyMd" tone="subdued">
                    データソースがまだ登録されていません。Step 1からデータを取得してください。
                  </s-text>
                ) : (
                  <s-text variant="bodyMd">
                    {dataSources.length}件のデータソースが登録されています。
                  </s-text>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

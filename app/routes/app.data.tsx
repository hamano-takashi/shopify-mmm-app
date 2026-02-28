import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { syncShopifyData, getShopifyDataSummary } from "../services/shopify-data.server";
import { generateExcelTemplate } from "../services/excel-template.server";
import { parseExcelUpload } from "../services/excel-parser.server";
import { saveExcelData } from "../services/data-merger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Ensure shop record exists
  const shop = await ensureShop(shopDomain);

  const dataSources = await db.dataSource.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  // Get Shopify data summary
  const shopifySummary = await getShopifyDataSummary(shop.id);

  return { shopDomain, shop, dataSources, shopifySummary };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const shop = await ensureShop(shopDomain);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "sync_shopify") {
    const result = await syncShopifyData(admin, shop.id);
    return { success: result.success, message: result.message };
  }

  if (intent === "download_template") {
    const buffer = await generateExcelTemplate({ shopId: shop.id });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=mmm-template.xlsx",
      },
    });
  }

  if (intent === "upload_excel") {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, message: "ファイルが選択されていません" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse and validate
    const parseResult = await parseExcelUpload(buffer);

    if (!parseResult.success) {
      return {
        success: false,
        message: `バリデーションエラー: ${parseResult.errors.map((e) => e.message).join(", ")}`,
        validation: parseResult,
      };
    }

    // Save to database
    const saveResult = await saveExcelData(shop.id, parseResult.data);

    const warningMsg = parseResult.warnings.length > 0
      ? ` (警告: ${parseResult.warnings.map((w) => w.message).join(", ")})`
      : "";

    return {
      success: true,
      message: `${saveResult.count}件のデータを保存しました${warningMsg}`,
      validation: parseResult,
    };
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

        {/* Step 2: Excel Template Download */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 2: テンプレートダウンロード</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  Excelテンプレートをダウンロードし、Google Ads・Meta Ads・LINE広告等の
                  外部チャネルデータを入力してください。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <a href="/api/template/download" download style={{ textDecoration: "none" }}>
                  <s-button>テンプレートをダウンロード (.xlsx)</s-button>
                </a>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 3: Excel Upload */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 3: 外部データアップロード</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  記入済みのExcelファイルをアップロードしてください。
                  自動でバリデーションを行い、データを統合します。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <form method="post" encType="multipart/form-data">
                  <input type="hidden" name="intent" value="upload_excel" />
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="file"
                      name="file"
                      accept=".xlsx,.xls"
                      style={{ fontSize: "14px" }}
                    />
                    <s-button variant="primary" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "アップロード中..." : "アップロード"}
                    </s-button>
                  </div>
                </form>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 4: Channel Config */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 4: チャネル変数設定</s-text>
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

        {/* Step 5: Data Preview */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Step 5: データプレビュー</s-text>
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

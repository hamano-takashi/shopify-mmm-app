import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  return {
    shop,
    plan: shopRecord?.plan || "TRIAL",
    trialEndsAt: shopRecord?.trialEndsAt?.toISOString() || null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete_all_data") {
    // GDPR: Delete all shop data
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });

    if (shop) {
      // Cascade delete: DataSource -> DailyDataPoint, Analysis
      await db.shop.delete({ where: { id: shop.id } });
      return { success: true, message: "全データを削除しました" };
    }

    return { success: false, message: "ショップデータが見つかりません" };
  }

  return { success: false, message: "不明なアクションです" };
};

export default function Settings() {
  const { shop, plan, trialEndsAt } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page title="設定">
      {actionData?.message && (
        <s-banner
          tone={actionData.success ? "success" : "critical"}
          onDismiss={() => {}}
        >
          {actionData.message}
        </s-banner>
      )}

      <s-layout>
        {/* Plan Info */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">プラン情報</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd">ショップ: {shop}</s-text>
                <s-text variant="bodyMd">
                  現在のプラン: {plan}
                </s-text>
                {trialEndsAt && (
                  <s-text variant="bodyMd" tone="subdued">
                    トライアル期限:{" "}
                    {new Date(trialEndsAt).toLocaleDateString("ja-JP")}
                  </s-text>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Analysis Settings */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">分析設定</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  デフォルトの分析パラメータを設定します。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <s-select
                  label="目的変数"
                  name="dep_var"
                  options={JSON.stringify([
                    { label: "売上（Net Sales）", value: "net_sales" },
                    { label: "注文数（Orders）", value: "orders" },
                    { label: "セッション数", value: "sessions" },
                  ])}
                />
              </s-box>
              <s-box padding-block-start="200">
                <s-select
                  label="分析期間"
                  name="date_range"
                  options={JSON.stringify([
                    { label: "過去90日", value: "90d" },
                    { label: "過去180日", value: "180d" },
                    { label: "過去365日", value: "365d" },
                  ])}
                />
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Data Management (GDPR) */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">データ管理</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodyMd" tone="subdued">
                  保存されている全てのデータを削除できます。
                  この操作は元に戻せません。
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <form method="post">
                  <input type="hidden" name="intent" value="delete_all_data" />
                  <s-button tone="critical" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "削除中..." : "全データを削除"}
                  </s-button>
                </form>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

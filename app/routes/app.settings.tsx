import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const dataSources = await db.dataSource.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  const dataSourceDetails = await Promise.all(
    dataSources.map(async (ds) => {
      const pointCount = await db.dailyDataPoint.count({
        where: { dataSourceId: ds.id },
      });
      const dateRange = await db.dailyDataPoint.aggregate({
        where: { dataSourceId: ds.id },
        _min: { date: true },
        _max: { date: true },
      });
      const variables = await db.dailyDataPoint.findMany({
        where: { dataSourceId: ds.id },
        distinct: ["variable"],
        select: { variable: true },
      });
      return {
        ...ds,
        pointCount,
        dateStart: dateRange._min.date,
        dateEnd: dateRange._max.date,
        variables: variables.map((v) => v.variable),
      };
    })
  );

  const analysisCount = await db.analysis.count({
    where: { shopId: shop.id },
  });

  return {
    shopDomain: session.shop,
    plan: shop.plan || "TRIAL",
    trialEndsAt: shop.trialEndsAt?.toISOString() || null,
    dataSources: dataSourceDetails,
    analysisCount,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete_all_data") {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });

    if (shop) {
      await db.shop.delete({ where: { id: shop.id } });
      return { success: true, message: "全データを削除しました" };
    }
    return { success: false, message: "ショップデータが見つかりません" };
  }

  if (intent === "delete_datasource") {
    const dsId = formData.get("datasource_id") as string;
    if (dsId) {
      await db.dailyDataPoint.deleteMany({ where: { dataSourceId: dsId } });
      await db.dataSource.delete({ where: { id: dsId } });
      return { success: true, message: "データソースを削除しました" };
    }
  }

  return { success: false, message: "不明なアクションです" };
};

const DS_TYPE_LABELS: Record<string, string> = {
  SHOPIFY_AUTO: "Shopify自動同期",
  EXCEL_UPLOAD: "Excelアップロード",
  API_GOOGLE: "Google Ads API",
  API_META: "Meta Ads API",
};

const DS_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "有効",
  SYNCING: "同期中",
  PENDING: "待機中",
  ERROR: "エラー",
};

export default function Settings() {
  const { shopDomain, plan, trialEndsAt, dataSources, analysisCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const deleteFetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page title="設定">
      {actionData?.message && (
        <s-banner tone={actionData.success ? "success" : "critical"}>
          {actionData.message}
        </s-banner>
      )}

      <s-layout>
        {/* Shop Info */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">ショップ情報</s-text>
              <s-box padding-block-start="300">
                <table style={{ fontSize: "14px" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>ショップ</td>
                      <td style={{ padding: "4px 0", fontWeight: 500 }}>{shopDomain}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>プラン</td>
                      <td style={{ padding: "4px 0", fontWeight: 500 }}>{plan}</td>
                    </tr>
                    {trialEndsAt && (
                      <tr>
                        <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>トライアル期限</td>
                        <td style={{ padding: "4px 0" }}>{new Date(trialEndsAt).toLocaleDateString("ja-JP")}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>分析回数</td>
                      <td style={{ padding: "4px 0" }}>{analysisCount}回</td>
                    </tr>
                  </tbody>
                </table>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Data Sources */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">データソース</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  登録済みのデータソースと保持データの状態
                </s-text>
              </s-box>
              <s-box padding-block-start="300">
                {dataSources.length === 0 ? (
                  <s-text variant="bodyMd" tone="subdued">
                    データソースがまだ登録されていません。
                  </s-text>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {dataSources.map((ds) => (
                      <div
                        key={ds.id}
                        style={{
                          padding: "12px 16px",
                          border: "1px solid #e1e3e5",
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{
                              display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                              backgroundColor: ds.status === "ACTIVE" ? "#108043" : ds.status === "ERROR" ? "#DE3618" : "#EEC200",
                            }} />
                            <s-text variant="bodyMd" fontWeight="semibold">
                              {DS_TYPE_LABELS[ds.type] || ds.type}
                            </s-text>
                            <span style={{ fontSize: "12px", color: "#637381", padding: "2px 8px", background: "#F1F1F1", borderRadius: "4px" }}>
                              {DS_STATUS_LABELS[ds.status] || ds.status}
                            </span>
                          </div>
                          <deleteFetcher.Form method="post">
                            <input type="hidden" name="intent" value="delete_datasource" />
                            <input type="hidden" name="datasource_id" value={ds.id} />
                            <s-button tone="critical" size="slim" variant="plain" type="submit">
                              削除
                            </s-button>
                          </deleteFetcher.Form>
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "13px", color: "#637381" }}>
                          <div>{ds.pointCount.toLocaleString()} データポイント</div>
                          {ds.dateStart && ds.dateEnd && (
                            <div>
                              期間: {new Date(ds.dateStart).toLocaleDateString("ja-JP")} 〜{" "}
                              {new Date(ds.dateEnd).toLocaleDateString("ja-JP")}
                            </div>
                          )}
                          {ds.lastSync && (
                            <div>最終同期: {new Date(ds.lastSync).toLocaleString("ja-JP")}</div>
                          )}
                          {ds.variables.length > 0 && (
                            <div style={{ marginTop: "4px" }}>
                              変数: {ds.variables.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
                <s-text variant="bodySm" tone="subdued">
                  デフォルトの分析パラメータ
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

        {/* Danger Zone */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd" tone="critical">データ管理</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  保存されている全てのデータを削除します。この操作は元に戻せません。
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

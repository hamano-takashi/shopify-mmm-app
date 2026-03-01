import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { normalizePlan, getPlanFeatures } from "../services/billing.server";

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

  const plan = normalizePlan(shop.plan || "FREE");
  const features = getPlanFeatures(plan);

  return {
    shopDomain: session.shop,
    plan,
    features,
    trialEndsAt: shop.trialEndsAt?.toISOString() || null,
    subscriptionId: shop.subscriptionId,
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
      return { success: true, message: "All data has been deleted" };
    }
    return { success: false, message: "Shop data not found" };
  }

  if (intent === "delete_datasource") {
    const dsId = formData.get("datasource_id") as string;
    if (dsId) {
      await db.dailyDataPoint.deleteMany({ where: { dataSourceId: dsId } });
      await db.dataSource.delete({ where: { id: dsId } });
      return { success: true, message: "Data source deleted" };
    }
  }

  return { success: false, message: "Unknown action" };
};

const DS_TYPE_LABELS: Record<string, string> = {
  SHOPIFY_AUTO: "Shopify Auto Sync",
  EXCEL_UPLOAD: "Excel Upload",
  API_GOOGLE: "Google Ads API",
  API_META: "Meta Ads API",
};

const DS_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  SYNCING: "Syncing",
  PENDING: "Pending",
  ERROR: "Error",
};

export default function Settings() {
  const { shopDomain, plan, features, trialEndsAt, subscriptionId, dataSources, analysisCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page title="Settings">
      {actionData?.message && (
        <s-banner tone={actionData.success ? "success" : "critical"}>
          {actionData.message}
        </s-banner>
      )}

      <s-layout>
        {/* Shop Info & Plan */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <s-text variant="headingMd">Shop Information</s-text>
                <s-button size="slim" onClick={() => navigate("/app/plans")}>
                  Manage Plan
                </s-button>
              </div>
              <s-box padding-block-start="300">
                <table style={{ fontSize: "14px" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Shop</td>
                      <td style={{ padding: "4px 0", fontWeight: 500 }}>{shopDomain}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Plan</td>
                      <td style={{ padding: "4px 0", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {plan}
                          <s-badge tone={plan === "FREE" ? "info" : "success"}>{plan}</s-badge>
                        </div>
                      </td>
                    </tr>
                    {trialEndsAt && (
                      <tr>
                        <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Trial Expires</td>
                        <td style={{ padding: "4px 0" }}>{new Date(trialEndsAt).toLocaleDateString("en-US")}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "4px 16px 4px 0", color: "#637381" }}>Analyses Run</td>
                      <td style={{ padding: "4px 0" }}>{analysisCount}</td>
                    </tr>
                  </tbody>
                </table>
              </s-box>

              {/* Plan Features Summary */}
              <s-box padding-block-start="300">
                <s-text variant="bodySm" tone="subdued">Plan Features:</s-text>
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "12px", padding: "2px 8px", background: "#F1F1F1", borderRadius: "4px" }}>
                    {features.analysisPerMonth === -1 ? "Unlimited" : features.analysisPerMonth} analyses/mo
                  </span>
                  {features.excelExport && (
                    <span style={{ fontSize: "12px", padding: "2px 8px", background: "#E3F5E1", borderRadius: "4px", color: "#108043" }}>
                      Excel Export
                    </span>
                  )}
                  {features.budgetOptimization && (
                    <span style={{ fontSize: "12px", padding: "2px 8px", background: "#E3F5E1", borderRadius: "4px", color: "#108043" }}>
                      Budget Optimization
                    </span>
                  )}
                  {features.saturationAnalysis && (
                    <span style={{ fontSize: "12px", padding: "2px 8px", background: "#E3F5E1", borderRadius: "4px", color: "#108043" }}>
                      Saturation Analysis
                    </span>
                  )}
                </div>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Data Sources */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <s-text variant="headingMd">Data Sources</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  Registered data sources and their current status
                </s-text>
              </s-box>
              <s-box padding-block-start="300">
                {dataSources.length === 0 ? (
                  <s-text variant="bodyMd" tone="subdued">
                    No data sources registered yet.
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
                              Delete
                            </s-button>
                          </deleteFetcher.Form>
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "13px", color: "#637381" }}>
                          <div>{ds.pointCount.toLocaleString()} data points</div>
                          {ds.dateStart && ds.dateEnd && (
                            <div>
                              Period: {new Date(ds.dateStart).toLocaleDateString("en-US")} –{" "}
                              {new Date(ds.dateEnd).toLocaleDateString("en-US")}
                            </div>
                          )}
                          {ds.lastSync && (
                            <div>Last sync: {new Date(ds.lastSync).toLocaleString("en-US")}</div>
                          )}
                          {ds.variables.length > 0 && (
                            <div style={{ marginTop: "4px" }}>
                              Variables: {ds.variables.join(", ")}
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
              <s-text variant="headingMd">Analysis Settings</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  Default analysis parameters
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <s-select
                  label="Dependent Variable"
                  name="dep_var"
                  options={JSON.stringify([
                    { label: "Net Sales", value: "net_sales" },
                    { label: "Orders", value: "orders" },
                    { label: "Sessions", value: "sessions" },
                  ])}
                />
              </s-box>
              <s-box padding-block-start="200">
                <s-select
                  label="Analysis Period"
                  name="date_range"
                  options={JSON.stringify([
                    { label: "Last 90 days", value: "90d" },
                    { label: "Last 180 days", value: "180d" },
                    { label: "Last 365 days", value: "365d" },
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
              <s-text variant="headingMd" tone="critical">Data Management</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  Delete all saved data. This action cannot be undone.
                </s-text>
              </s-box>
              <s-box padding-block-start="400">
                <form method="post">
                  <input type="hidden" name="intent" value="delete_all_data" />
                  <s-button tone="critical" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Deleting..." : "Delete All Data"}
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

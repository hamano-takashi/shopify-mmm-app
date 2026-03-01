import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { exportMergedDataAsCSV } from "../services/data-merger.server";
import { canRunAnalysis, getPlanFeatures, normalizePlan } from "../services/billing.server";

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

  // Check analysis quota
  const quota = await canRunAnalysis(shop.id, shop.plan);

  return {
    shopDomain: session.shop,
    dataSourceCount,
    analyses,
    plan: normalizePlan(shop.plan),
    analysisQuota: quota,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "start_analysis") {
    const shop = await ensureShop(session.shop);

    // Check analysis quota
    const quota = await canRunAnalysis(shop.id, shop.plan);
    if (!quota.allowed) {
      return { success: false, message: quota.reason || "Analysis limit reached." };
    }

    // Verify data exists
    const dataCount = await db.dataSource.count({
      where: { shopId: shop.id },
    });

    if (dataCount === 0) {
      return { success: false, message: "No data found. Please set up your data first." };
    }

    // Run OLS regression analysis
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

  return { success: false, message: "Unknown action" };
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
      return "Pending";
    case "RUNNING":
      return "Running";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export default function Analysis() {
  const { dataSourceCount, analyses, plan, analysisQuota } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";
  const hasData = dataSourceCount > 0;
  const isQuotaExceeded = !analysisQuota.allowed;

  return (
    <s-page
      title="Run Analysis"
      subtitle="Run Marketing Mix Modeling to analyze channel contributions"
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
              <s-text variant="headingMd">Start New Analysis</s-text>
              <s-box padding-block-start="200">
                {!hasData ? (
                  <s-text variant="bodyMd" tone="subdued">
                    To start an analysis, please set up your data on the Data Setup page first.
                  </s-text>
                ) : isQuotaExceeded ? (
                  <>
                    <s-banner tone="warning">
                      {analysisQuota.reason}
                    </s-banner>
                    <s-box padding-block-start="300">
                      <s-button variant="primary" onClick={() => navigate("/app/plans")}>
                        Upgrade Plan
                      </s-button>
                    </s-box>
                  </>
                ) : (
                  <>
                    <s-text variant="bodyMd" tone="subdued">
                      Run MMM using your registered data.
                      Analysis typically takes 5-15 minutes.
                    </s-text>
                    {plan === "FREE" && analysisQuota.limit > 0 && (
                      <s-box padding-block-start="200">
                        <s-text variant="bodySm" tone="subdued">
                          Free plan: {analysisQuota.used}/{analysisQuota.limit} analyses used this month
                        </s-text>
                      </s-box>
                    )}
                    <s-box padding-block-start="400">
                      <form method="post">
                        <input type="hidden" name="intent" value="start_analysis" />
                        <s-button
                          variant="primary"
                          type="submit"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Starting..." : "Start Analysis"}
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
              <s-text variant="headingMd">Analysis History</s-text>
              <s-box padding-block-start="200">
                {analyses.length === 0 ? (
                  <s-text variant="bodyMd" tone="subdued">
                    No analyses have been run yet.
                  </s-text>
                ) : (
                  <div>
                    {analyses.map((analysis) => (
                      <div
                        key={analysis.id}
                        onClick={() => {
                          if (analysis.status === "COMPLETED") {
                            navigate(`/app/results/${analysis.id}`);
                          }
                        }}
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #e1e3e5",
                          cursor: analysis.status === "COMPLETED" ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <s-text variant="bodyMd">
                            Analysis #{analysis.id.slice(0, 8)}
                          </s-text>
                          <s-badge tone={getStatusBadgeTone(analysis.status)}>
                            {getStatusLabel(analysis.status)}
                          </s-badge>
                          {analysis.status === "COMPLETED" && (
                            <s-button
                              variant="plain"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                navigate(`/app/results/${analysis.id}`);
                              }}
                            >
                              View Results →
                            </s-button>
                          )}
                        </div>
                        <s-text variant="bodySm" tone="subdued">
                          {new Date(analysis.createdAt).toLocaleString("en-US")}
                        </s-text>
                      </div>
                    ))}
                  </div>
                )}
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

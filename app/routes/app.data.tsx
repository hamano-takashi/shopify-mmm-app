import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/shop.server";
import { syncShopifyData, getShopifyDataSummary } from "../services/shopify-data.server";
import { parseExcelUpload } from "../services/excel-parser.server";
import { saveExcelData } from "../services/data-merger.server";
import { seedTestData } from "../services/seed-test-data.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const shop = await ensureShop(shopDomain);

  const dataSources = await db.dataSource.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  const shopifySummary = await getShopifyDataSummary(shop.id);

  const hasExcelData = dataSources.some((ds) => ds.type === "EXCEL_UPLOAD");

  const excelPointCount = hasExcelData
    ? await db.dailyDataPoint.count({
        where: {
          dataSource: { shopId: shop.id, type: "EXCEL_UPLOAD" },
        },
      })
    : 0;

  return { shopDomain, shop, dataSources, shopifySummary, hasExcelData, excelPointCount };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const shop = await ensureShop(shopDomain);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "seed_test_data") {
      const result = await seedTestData(shop.id);
      return { success: result.success, message: result.message };
    }

    if (intent === "sync_shopify") {
      const result = await syncShopifyData(admin, shop.id);
      return { success: result.success, message: result.message };
    }

    if (intent === "upload_excel") {
      const file = formData.get("file") as File | null;
      if (!file) {
        return { success: false, message: "No file selected" };
      }

      // File size validation (max 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, message: "File too large. Maximum size is 5MB." };
      }

      // MIME type validation
      const allowedTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
      ];
      const fileName = file.name.toLowerCase();
      if (!allowedTypes.includes(file.type) && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        return { success: false, message: "Invalid file type. Please upload an Excel file (.xlsx or .xls)." };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parseResult = await parseExcelUpload(buffer);

      if (!parseResult.success) {
        return {
          success: false,
          message: `Validation error: ${parseResult.errors.map((e) => e.message).join(", ")}`,
        };
      }

      const saveResult = await saveExcelData(shop.id, parseResult.data);
      const warningMsg =
        parseResult.warnings.length > 0
          ? ` (Warning: ${parseResult.warnings.map((w) => w.message).join(", ")})`
          : "";

      return {
        success: true,
        message: `${saveResult.count} data points saved${warningMsg}`,
      };
    }
  } catch (error) {
    console.error("Action error:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  return { success: false, message: "Unknown action" };
};

function StepIndicator({ step, done, active }: { step: number; done: boolean; active: boolean }) {
  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        backgroundColor: done ? "#108043" : active ? "#5C6AC4" : "#DFE3E8",
        color: done || active ? "white" : "#637381",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: "14px",
        flexShrink: 0,
      }}
    >
      {done ? "\u2713" : step}
    </div>
  );
}

export default function DataPrep() {
  const { dataSources, shopifySummary, hasExcelData, excelPointCount } =
    useLoaderData<typeof loader>();
  const syncFetcher = useFetcher<{ success: boolean; message: string }>();
  const uploadFetcher = useFetcher<{ success: boolean; message: string }>();
  const seedFetcher = useFetcher<{ success: boolean; message: string }>();
  const navigate = useNavigate();

  const isSyncing = syncFetcher.state !== "idle";
  const isUploading = uploadFetcher.state !== "idle";
  const isSeeding = seedFetcher.state !== "idle";

  const syncResult = syncFetcher.data;
  const uploadResult = uploadFetcher.data;
  const seedResult = seedFetcher.data;

  const step1Done = shopifySummary?.hasData || false;
  const step2Done = hasExcelData;
  const allReady = step1Done && step2Done;

  return (
    <s-page
      title="Data Setup"
      subtitle="Sync Shopify data and upload external ad data"
    >
      {syncResult?.message && (
        <s-banner tone={syncResult.success ? "success" : "critical"}>
          {syncResult.message}
        </s-banner>
      )}
      {uploadResult?.message && (
        <s-banner tone={uploadResult.success ? "success" : "critical"}>
          {uploadResult.message}
        </s-banner>
      )}
      {seedResult?.message && (
        <s-banner tone={seedResult.success ? "success" : "critical"}>
          {seedResult.message}
        </s-banner>
      )}

      {/* Progress Bar */}
      <s-layout>
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StepIndicator step={1} done={step1Done} active={!step1Done} />
                <div style={{ flex: 1, height: "2px", backgroundColor: step1Done ? "#108043" : "#DFE3E8" }} />
                <StepIndicator step={2} done={step2Done} active={step1Done && !step2Done} />
                <div style={{ flex: 1, height: "2px", backgroundColor: step2Done ? "#108043" : "#DFE3E8" }} />
                <StepIndicator step={3} done={allReady} active={step2Done && !allReady} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px", color: "#637381" }}>
                <span>Shopify Sync</span>
                <span>Ad Data</span>
                <span>Ready to Analyze</span>
              </div>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 1: Shopify Auto Sync */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <StepIndicator step={1} done={step1Done} active={!step1Done} />
                <div style={{ flex: 1 }}>
                  <s-text variant="headingMd">Shopify Data (Auto Sync)</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      Automatically fetch revenue, orders, and discount data via the Orders API.
                      After the initial sync, new orders are reflected automatically via webhooks.
                    </s-text>
                  </s-box>
                  {shopifySummary?.hasData && (
                    <s-box padding-block-start="200">
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ padding: "8px 12px", background: "#F1F8F5", borderRadius: "6px", fontSize: "13px" }}>
                          <span style={{ color: "#108043", fontWeight: 600 }}>{shopifySummary.pointCount.toLocaleString()}</span>
                          <span style={{ color: "#637381" }}> data points</span>
                        </div>
                        {shopifySummary.lastSync && (
                          <div style={{ padding: "8px 12px", background: "#F1F8F5", borderRadius: "6px", fontSize: "13px" }}>
                            <span style={{ color: "#637381" }}>Last sync: </span>
                            <span style={{ fontWeight: 500 }}>
                              {new Date(shopifySummary.lastSync).toLocaleString("en-US")}
                            </span>
                          </div>
                        )}
                      </div>
                    </s-box>
                  )}
                  <s-box padding-block-start="300">
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      <syncFetcher.Form method="post">
                        <input type="hidden" name="intent" value="sync_shopify" />
                        <s-button variant="primary" type="submit" disabled={isSyncing}>
                          {isSyncing ? "Syncing..." : step1Done ? "Re-sync" : "Sync Shopify Data"}
                        </s-button>
                      </syncFetcher.Form>
                      <seedFetcher.Form method="post">
                        <input type="hidden" name="intent" value="seed_test_data" />
                        <s-button type="submit" disabled={isSeeding}>
                          {isSeeding ? "Generating..." : "Generate Test Data"}
                        </s-button>
                      </seedFetcher.Form>
                    </div>
                  </s-box>
                </div>
              </div>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Step 2: Excel Upload (Template + Upload combined) */}
        <s-layout-section>
          <s-card>
            <s-box padding="400">
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <StepIndicator step={2} done={step2Done} active={step1Done && !step2Done} />
                <div style={{ flex: 1 }}>
                  <s-text variant="headingMd">External Ad Data</s-text>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd" tone="subdued">
                      Upload ad spend, impressions, and click data from Google Ads, Meta Ads, LINE Ads, etc.
                    </s-text>
                  </s-box>

                  {step2Done && (
                    <s-box padding-block-start="200">
                      <div style={{ padding: "8px 12px", background: "#F1F8F5", borderRadius: "6px", fontSize: "13px", display: "inline-block" }}>
                        <span style={{ color: "#108043", fontWeight: 600 }}>{excelPointCount.toLocaleString()}</span>
                        <span style={{ color: "#637381" }}> data points uploaded</span>
                      </div>
                    </s-box>
                  )}

                  <s-box padding-block-start="300">
                    <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                      {/* Template Download */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", color: "#637381", width: "60px" }}>Step A:</span>
                        <s-button
                          size="slim"
                          onClick={() => {
                            fetch("/api/template/download")
                              .then((res) => res.blob())
                              .then((blob) => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "mmm-template.xlsx";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              })
                              .catch((err) => console.error("Download error:", err));
                          }}
                        >
                          Download Template
                        </s-button>
                      </div>

                      {/* Upload */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", color: "#637381", width: "60px" }}>Step B:</span>
                        <uploadFetcher.Form method="post" encType="multipart/form-data">
                          <input type="hidden" name="intent" value="upload_excel" />
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              type="file"
                              name="file"
                              accept=".xlsx,.xls"
                              style={{ fontSize: "14px" }}
                            />
                            <s-button variant="primary" size="slim" type="submit" disabled={isUploading}>
                              {isUploading ? "Uploading..." : "Upload"}
                            </s-button>
                          </div>
                        </uploadFetcher.Form>
                      </div>
                    </div>
                  </s-box>
                </div>
              </div>
            </s-box>
          </s-card>
        </s-layout-section>

        {/* Ready to Analyze */}
        <s-layout-section fullWidth>
          <s-card>
            <s-box padding="400">
              {allReady ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <s-text variant="headingMd">Ready to Analyze</s-text>
                    <s-box padding-block-start="100">
                      <s-text variant="bodySm" tone="subdued">
                        Shopify data + ad data are ready. You can start the analysis.
                      </s-text>
                    </s-box>
                  </div>
                  <s-button variant="primary" onClick={() => navigate("/app/analysis")}>
                    Go to Analysis
                  </s-button>
                </div>
              ) : (
                <div>
                  <s-text variant="headingMd" tone="subdued">Preparing for Analysis</s-text>
                  <s-box padding-block-start="100">
                    <s-text variant="bodySm" tone="subdued">
                      {!step1Done && !step2Done
                        ? "Please complete Step 1 (Shopify Sync) and Step 2 (Ad Data)."
                        : !step1Done
                          ? "Please complete Step 1 (Shopify Sync)."
                          : "Please complete Step 2 (Ad Data Upload)."}
                    </s-text>
                  </s-box>
                </div>
              )}
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

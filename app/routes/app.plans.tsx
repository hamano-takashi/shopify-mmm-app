import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { PLAN_STARTER, PLAN_PRO } from "../constants/plans";
import { ensureShop } from "../services/shop.server";
import { syncBillingStatus, normalizePlan } from "../services/billing.server";
import type { PlanName } from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // Sync billing status from Shopify
  const currentPlan = await syncBillingStatus(session.shop, billing);

  return { shopDomain: session.shop, currentPlan };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "subscribe") {
    const plan = formData.get("plan") as string;

    if (plan === PLAN_STARTER || plan === PLAN_PRO) {
      // billing.request redirects to Shopify payment page (throws redirect)
      await billing.request({
        plan,
        isTest: process.env.NODE_ENV !== "production",
      });
    }
  }

  if (intent === "cancel") {
    // Get current subscription to cancel
    const { appSubscriptions } = await billing.check();
    const activeSub = appSubscriptions.find((s) => s.status === "ACTIVE");

    if (activeSub) {
      await billing.cancel({
        subscriptionId: activeSub.id,
        isTest: process.env.NODE_ENV !== "production",
        prorate: true,
      });

      // Sync to DB
      await syncBillingStatus(session.shop, billing);

      return { success: true, message: "Subscription cancelled. You are now on the Free plan." };
    }

    return { success: false, message: "No active subscription found." };
  }

  return { success: false, message: "Unknown action" };
};

interface PlanDef {
  id: PlanName;
  billingName?: string;
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    priceNote: "forever",
    features: [
      "Dashboard overview",
      "Shopify data sync",
      "1 analysis per month",
      "Basic results view",
    ],
    cta: "Current Plan",
  },
  {
    id: "STARTER",
    billingName: PLAN_STARTER,
    name: "Starter",
    price: "$19",
    priceNote: "per month",
    highlighted: true,
    features: [
      "Everything in Free",
      "Unlimited analyses",
      "Excel report export",
      "All channel details",
      "7-day free trial",
    ],
    cta: "Start Free Trial",
  },
  {
    id: "PRO",
    billingName: PLAN_PRO,
    name: "Pro",
    price: "$49",
    priceNote: "per month",
    features: [
      "Everything in Starter",
      "Budget optimization",
      "Saturation analysis",
      "Marginal ROI insights",
      "7-day free trial",
    ],
    cta: "Start Free Trial",
  },
];

export default function Plans() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const planOrder: PlanName[] = ["FREE", "STARTER", "PRO"];
  const currentIndex = planOrder.indexOf(currentPlan as PlanName);

  return (
    <s-page title="Plans & Pricing" backAction={{ url: "/app/settings" }}>
      {actionData?.message && (
        <s-banner tone={actionData.success ? "success" : "critical"}>
          {actionData.message}
        </s-banner>
      )}

      <s-layout>
        <s-layout-section fullWidth>
          <s-box padding-block-end="400">
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <s-text variant="headingLg">Choose the right plan for your business</s-text>
            </div>
            <div style={{ textAlign: "center" }}>
              <s-text variant="bodyMd" tone="subdued">
                All paid plans include a 7-day free trial. Cancel anytime.
              </s-text>
            </div>
          </s-box>
        </s-layout-section>

        {/* Plan Cards */}
        <s-layout-section variant="oneThird">
          {renderPlanCard(PLANS[0], currentPlan, currentIndex, isSubmitting)}
        </s-layout-section>
        <s-layout-section variant="oneThird">
          {renderPlanCard(PLANS[1], currentPlan, currentIndex, isSubmitting)}
        </s-layout-section>
        <s-layout-section variant="oneThird">
          {renderPlanCard(PLANS[2], currentPlan, currentIndex, isSubmitting)}
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

function renderPlanCard(
  plan: PlanDef,
  currentPlan: string,
  currentIndex: number,
  isSubmitting: boolean,
) {
  const planOrder: PlanName[] = ["FREE", "STARTER", "PRO"];
  const planIndex = planOrder.indexOf(plan.id);
  const isCurrent = plan.id === currentPlan;
  const isUpgrade = planIndex > currentIndex;
  const isDowngrade = planIndex < currentIndex;

  return (
    <s-card>
      <s-box padding="400">
        {/* Plan header */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          {isCurrent && (
            <div style={{ marginBottom: "8px" }}>
              <s-badge tone="success">Current Plan</s-badge>
            </div>
          )}
          {plan.highlighted && !isCurrent && (
            <div style={{ marginBottom: "8px" }}>
              <s-badge tone="info">Most Popular</s-badge>
            </div>
          )}
          <s-text variant="headingMd">{plan.name}</s-text>
          <div style={{ marginTop: "8px" }}>
            <span style={{ fontSize: "36px", fontWeight: 700 }}>{plan.price}</span>
            <span style={{ color: "#637381", fontSize: "14px", marginLeft: "4px" }}>
              /{plan.priceNote}
            </span>
          </div>
        </div>

        {/* Features */}
        <div style={{
          borderTop: "1px solid #e1e3e5",
          paddingTop: "16px",
          marginBottom: "16px",
        }}>
          {plan.features.map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 0",
                fontSize: "14px",
              }}
            >
              <span style={{ color: "#108043", fontWeight: 700 }}>{"\u2713"}</span>
              {feature}
            </div>
          ))}
        </div>

        {/* Action button */}
        <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "16px" }}>
          {isCurrent ? (
            <s-button disabled fullWidth>
              Current Plan
            </s-button>
          ) : isUpgrade ? (
            <form method="post">
              <input type="hidden" name="intent" value="subscribe" />
              <input type="hidden" name="plan" value={plan.billingName || ""} />
              <s-button variant="primary" type="submit" disabled={isSubmitting} fullWidth>
                {isSubmitting ? "Processing..." : `Upgrade to ${plan.name}`}
              </s-button>
            </form>
          ) : isDowngrade ? (
            plan.id === "FREE" ? (
              <form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <s-button tone="critical" type="submit" disabled={isSubmitting} fullWidth>
                  {isSubmitting ? "Processing..." : "Downgrade to Free"}
                </s-button>
              </form>
            ) : (
              <form method="post">
                <input type="hidden" name="intent" value="subscribe" />
                <input type="hidden" name="plan" value={plan.billingName || ""} />
                <s-button type="submit" disabled={isSubmitting} fullWidth>
                  {isSubmitting ? "Processing..." : `Switch to ${plan.name}`}
                </s-button>
              </form>
            )
          ) : null}
        </div>
      </s-box>
    </s-card>
  );
}

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { billingPlanToInternal } from "../services/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!payload) {
    return new Response();
  }

  const subscription = payload as {
    app_subscription?: {
      admin_graphql_api_id?: string;
      name?: string;
      status?: string;
    };
  };

  const sub = subscription.app_subscription;
  if (!sub) {
    return new Response();
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return new Response();
  }

  const status = sub.status?.toUpperCase();

  if (status === "ACTIVE") {
    // Subscription activated or renewed
    const plan = billingPlanToInternal(sub.name || "");
    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        plan,
        subscriptionId: sub.admin_graphql_api_id || null,
        trialEndsAt: null,
      },
    });
    console.log(`Shop ${shop} upgraded to ${plan}`);
  } else if (
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "DECLINED"
  ) {
    // Subscription ended
    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        plan: "FREE",
        subscriptionId: null,
        trialEndsAt: null,
      },
    });
    console.log(`Shop ${shop} downgraded to FREE (${status})`);
  }

  return new Response();
};

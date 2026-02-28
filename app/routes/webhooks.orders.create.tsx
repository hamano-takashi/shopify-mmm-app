import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { processOrderWebhook } from "../services/shopify-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await processOrderWebhook(shop, {
      created_at: payload.created_at,
      subtotal_price: String(payload.subtotal_price ?? "0"),
      total_discounts: String(payload.total_discounts ?? "0"),
    });
    console.log(`Order processed for ${shop}: ${payload.created_at}`);
  } catch (error) {
    console.error(`Webhook order processing error for ${shop}:`, error);
  }

  return new Response();
};

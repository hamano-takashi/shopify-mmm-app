import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData, getShopData } from "../services/shop.server";

/**
 * GDPR compliance webhooks.
 * Handles: customers/data_request, customers/redact, shop/redact
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received GDPR webhook: ${topic} for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      // Customer data request: return stored customer data
      // This app stores aggregated sales data, NOT individual customer PII.
      // We respond with the shop-level aggregated data.
      const shopData = await getShopData(shop);

      if (shopData) {
        console.log(
          `Customer data request for ${shop}: ` +
            `${shopData.dataSources.length} data sources, ` +
            `${shopData.analyses.length} analyses`
        );
      }

      // In production, you would send this data to the shop owner
      // via the Shopify API or email. For now, we log it.
      break;
    }

    case "CUSTOMERS_REDACT": {
      // Customer data redaction request
      // This app does NOT store individual customer PII.
      // All data is aggregated at the daily level (net_sales, orders, sessions).
      // No per-customer data exists, so no redaction is needed.
      console.log(
        `Customer redact request for ${shop}: ` +
          `No individual customer data stored (aggregated data only)`
      );
      break;
    }

    case "SHOP_REDACT": {
      // Shop data redaction: delete ALL data for this shop
      // This is triggered 48 hours after app uninstall.
      const deleted = await deleteShopData(shop);
      console.log(
        `Shop redact for ${shop}: ${deleted ? "all data deleted" : "no data found"}`
      );
      break;
    }

    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response();
};

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../services/shop.server";
import { generateExcelTemplate } from "../services/excel-template.server";

/**
 * API route: Download Excel template for media data input.
 * GET /api/template/download
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const buffer = await generateExcelTemplate({ shopId: shop.id });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mmm-template-${session.shop}.xlsx"`,
      "Cache-Control": "no-cache",
    },
  });
};

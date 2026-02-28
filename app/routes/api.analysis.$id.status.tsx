import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * API route: Get analysis status for polling.
 * GET /api/analysis/:id/status
 * Used by the frontend to poll analysis progress every 3 seconds.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const analysisId = params.id;

  if (!analysisId) {
    return Response.json({ error: "Analysis ID required" }, { status: 400 });
  }

  const analysis = await db.analysis.findFirst({
    where: {
      id: analysisId,
      shop: { shopDomain: session.shop },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMsg: true,
    },
  });

  if (!analysis) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  return Response.json({
    id: analysis.id,
    status: analysis.status,
    startedAt: analysis.startedAt?.toISOString() || null,
    completedAt: analysis.completedAt?.toISOString() || null,
    errorMsg: analysis.errorMsg,
  });
};

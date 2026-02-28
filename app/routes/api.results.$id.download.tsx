import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const analysisId = params.id;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv";

  if (!analysisId) {
    throw new Response("Analysis ID is required", { status: 400 });
  }

  const analysis = await db.analysis.findFirst({
    where: {
      id: analysisId,
      shop: { shopDomain: session.shop },
      status: "COMPLETED",
    },
  });

  if (!analysis || !analysis.results) {
    throw new Response("Analysis results not found", { status: 404 });
  }

  const results = JSON.parse(analysis.results);
  const timestamp = new Date(analysis.createdAt).toISOString().slice(0, 10);

  if (format === "json") {
    return new Response(JSON.stringify(results, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=mmm-results-${timestamp}.json`,
      },
    });
  }

  // CSV format: channel contribution summary
  const channels = results.contribution?.channels || [];
  const csvLines = [
    "channel,contribution_pct,roas",
    ...channels.map(
      (ch: { name: string; contribution: number; roas: number }) =>
        `${ch.name},${ch.contribution},${ch.roas}`
    ),
  ];

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=mmm-results-${timestamp}.csv`,
    },
  });
};

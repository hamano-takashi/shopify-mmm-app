import { Queue } from "bullmq";
import db from "../db.server";

// BullMQ queue (lazy init) — uses built-in ioredis, no separate import needed
let analysisQueue: Queue | null = null;

function getQueue(): Queue {
  if (!analysisQueue) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const url = new URL(redisUrl);
    analysisQueue = new Queue("mmm-analysis", {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || "6379", 10),
        db: parseInt(url.pathname.slice(1) || "0", 10),
        maxRetriesPerRequest: null,
      },
    });
  }
  return analysisQueue;
}

interface AnalysisConfig {
  dep_var?: string;
  date_range?: string;
  channels?: string[];
  chains?: number;
  tune?: number;
  draws?: number;
}

/**
 * Start a new MMM analysis by creating a record and dispatching a BullMQ job.
 */
export async function startAnalysis(
  shopId: string,
  config: AnalysisConfig = {}
): Promise<{ analysisId: string; success: boolean; message: string }> {
  // Create analysis record
  const analysis = await db.analysis.create({
    data: {
      shopId,
      status: "PENDING",
      config: JSON.stringify({
        dep_var: config.dep_var || "net_sales",
        date_range: config.date_range || "180d",
        channels: config.channels || [],
        chains: config.chains || 4,
        tune: config.tune || 1000,
        draws: config.draws || 500,
      }),
    },
  });

  try {
    // Dispatch BullMQ job
    const queue = getQueue();
    await queue.add(
      "mmm-run",
      {
        analysis_id: analysis.id,
        shop_id: shopId,
        dep_var: config.dep_var || "net_sales",
        channels: config.channels || [],
        chains: config.chains || 4,
        tune: config.tune || 1000,
        draws: config.draws || 500,
      },
      {
        jobId: analysis.id,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    return {
      analysisId: analysis.id,
      success: true,
      message: `分析 #${analysis.id.slice(0, 8)} をキューに追加しました`,
    };
  } catch (error) {
    // If queue dispatch fails, update status
    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMsg: `キュー投入エラー: ${error instanceof Error ? error.message : "Redis接続エラー"}`,
      },
    });

    return {
      analysisId: analysis.id,
      success: false,
      message: "分析の開始に失敗しました。Redis接続を確認してください。",
    };
  }
}

/**
 * Get current status of an analysis.
 */
export async function getAnalysisStatus(analysisId: string) {
  const analysis = await db.analysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMsg: true,
    },
  });

  return analysis;
}

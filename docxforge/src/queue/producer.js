/**
 * Job Producer — DocxForge
 *
 * Enqueues document-generation jobs into BullMQ for async processing.
 */

import { Queue } from 'bullmq';

// ---------------------------------------------------------------------------
// Singleton queue instance
// ---------------------------------------------------------------------------

let queue = null;

/**
 * Get or create the BullMQ queue instance.
 *
 * @returns {Queue}
 */
export function getQueue() {
  if (!queue) {
    queue = new Queue('docxforge-render', {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null,
        connectTimeout: 3000,       // fail fast when Redis is unavailable
        retryStrategy: () => null,  // don't retry on initial connect failure
        lazyConnect: true,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return queue;
}

/**
 * Enqueue a document generation job.
 *
 * @param {string} jobId       Unique job identifier.
 * @param {object} payload     The validated request body (content, style, page, metadata).
 * @param {string} [webhookUrl]  Optional webhook URL to POST when job completes.
 * @returns {Promise<import('bullmq').Job>}
 */
export async function enqueueRenderJob(jobId, payload, webhookUrl) {
  const q = getQueue();
  return q.add(
    'render',
    { ...payload, webhook_url: webhookUrl },
    { jobId },
  );
}

/**
 * Get the current number of waiting + active jobs in the queue.
 * Returns -1 if Redis is unreachable (times out after 2s).
 *
 * @returns {Promise<number>}
 */
export async function getQueueDepth() {
  try {
    const q = getQueue();
    // Race against a timeout so we never block the health endpoint
    const result = await Promise.race([
      Promise.all([q.getWaitingCount(), q.getActiveCount()]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    const [waiting, active] = result;
    return waiting + active;
  } catch {
    // Redis may not be available — return -1 to signal unknown
    return -1;
  }
}

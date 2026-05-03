/**
 * BullMQ Worker — DocxForge
 *
 * Processes async document-generation jobs enqueued by the API.
 * Completed .docx buffers are stored in Redis (base64-encoded) under
 * `docxforge:result:<jobId>` with a configurable TTL.
 *
 * Run separately: `node src/queue/worker.js`
 */

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { renderDocument } from '../renderer/index.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const RESULT_TTL = parseInt(process.env.RESULT_TTL_SECONDS ?? '3600', 10); // 1 hour

// ---------------------------------------------------------------------------
// Redis client for storing results
// ---------------------------------------------------------------------------

const redis = new IORedis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null });

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = new Worker(
  'docxforge-render',
  async (job) => {
    const { content, style, page, metadata, webhook_url } = job.data;

    // Update progress: rendering
    await job.updateProgress(10);

    // Render the document
    const buffer = await renderDocument({ content, style, page, metadata });
    await job.updateProgress(90);

    // Store result in Redis with TTL
    const resultKey = `docxforge:result:${job.id}`;
    await redis.set(resultKey, buffer.toString('base64'), 'EX', RESULT_TTL);
    await job.updateProgress(100);

    // Fire webhook if configured
    if (webhook_url) {
      try {
        await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: job.id,
            status: 'done',
            download_url: `/v1/jobs/${job.id}/download`,
          }),
        });
      } catch (err) {
        // Webhook failure is non-fatal — log and continue
        console.error(`Webhook POST failed for job ${job.id}:`, err.message);
      }
    }

    return { success: true, size: buffer.length };
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
  },
);

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed (${job.returnvalue?.size ?? 0} bytes)`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

console.log('DocxForge worker started — waiting for jobs…');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down worker…');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

/**
 * Route — GET /v1/jobs/:id
 *
 * Returns the status of an async document-generation job.
 * When the job is complete, includes a download_url to retrieve the .docx.
 *
 * Also serves GET /v1/jobs/:id/download to stream the completed .docx.
 */

import IORedis from 'ioredis';
import { getQueue } from '../queue/producer.js';

let redis = null;

/**
 * Lazily initialize a Redis client for result retrieval.
 */
function getRedis() {
  if (!redis) {
    redis = new IORedis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
      retryStrategy: () => null,
      lazyConnect: true,
    });
  }
  return redis;
}

/**
 * Register the /v1/jobs/:id route.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export default async function jobsRoute(app) {
  // ── GET /v1/jobs/:id ────────────────────────────────────────────────────
  app.get('/v1/jobs/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const queue = getQueue();
      const job = await Promise.race([
        queue.getJob(id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
      ]);

      if (!job) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Job ${id} not found`,
        });
      }

      const state = await job.getState();
      const progress = typeof job.progress === 'number' ? job.progress : 0;

      const response = {
        job_id: id,
        status: mapState(state),
        progress,
      };

      // Include download URL when complete
      if (state === 'completed') {
        response.download_url = `/v1/jobs/${id}/download`;
      }

      // Include error message when failed
      if (state === 'failed') {
        response.error = job.failedReason ?? 'Unknown error';
      }

      return reply.send(response);
    } catch (err) {
      request.log.error(err, 'Failed to fetch job status');
      return reply.status(503).send({
        error: 'Queue Unavailable',
        message: 'Could not retrieve job status. Is Redis running?',
      });
    }
  });

  // ── GET /v1/jobs/:id/download ───────────────────────────────────────────
  app.get('/v1/jobs/:id/download', async (request, reply) => {
    const { id } = request.params;

    try {
      const r = getRedis();
      const base64 = await r.get(`docxforge:result:${id}`);

      if (!base64) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Result for job ${id} not found or has expired`,
        });
      }

      const buffer = Buffer.from(base64, 'base64');

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .header('Content-Disposition', `attachment; filename="job_${id}.docx"`)
        .send(buffer);
    } catch (err) {
      request.log.error(err, 'Failed to download job result');
      return reply.status(503).send({
        error: 'Download Error',
        message: err.message,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map BullMQ internal state to the API's status vocabulary.
 *
 * @param {string} state  BullMQ state string.
 * @returns {'queued'|'rendering'|'done'|'failed'}
 */
function mapState(state) {
  switch (state) {
    case 'waiting':
    case 'delayed':
    case 'prioritized':
      return 'queued';
    case 'active':
      return 'rendering';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}

/**
 * Route — POST /v1/documents/generate
 *
 * Accepts a Block[] payload and returns a .docx file (sync)
 * or enqueues a job (async).
 */

import { v4 as uuidv4 } from 'uuid';
import { GenerateRequestSchema } from '../schemas/generate.js';
import { renderDocument } from '../renderer/index.js';
import { enqueueRenderJob } from '../queue/producer.js';

/**
 * Register the /v1/documents/generate route.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export default async function generateRoute(app) {
  app.post('/v1/documents/generate', async (request, reply) => {
    // 1. Validate the request body with Zod
    const result = GenerateRequestSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: result.error.issues,
      });
    }

    const { content, style, page, metadata, async: isAsync, webhook_url } = result.data;

    // 2. Async path — enqueue to BullMQ
    if (isAsync) {
      const jobId = uuidv4();
      try {
        await enqueueRenderJob(jobId, { content, style, page, metadata }, webhook_url);
      } catch (err) {
        request.log.error(err, 'Failed to enqueue job');
        return reply.status(503).send({
          error: 'Queue Unavailable',
          message: 'Could not enqueue async job. Is Redis running?',
        });
      }

      return reply.status(202).send({
        job_id: jobId,
        status: 'queued',
      });
    }

    // 3. Sync path — render immediately and return the binary
    try {
      const buffer = await renderDocument({ content, style, page, metadata });

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .header(
          'Content-Disposition',
          `attachment; filename="${(metadata?.title ?? 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx"`,
        )
        .send(buffer);
    } catch (err) {
      request.log.error(err, 'Render failed');
      return reply.status(500).send({
        error: 'Render Error',
        message: err.message,
      });
    }
  });
}

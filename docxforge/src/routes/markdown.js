/**
 * Route — POST /v1/documents/from-markdown
 *
 * Accepts a Markdown string, converts it to Block[], then renders to .docx.
 */

import { MarkdownRequestSchema } from '../schemas/markdown.js';
import { markdownToBlocks } from '../parser/markdown.js';
import { renderDocument } from '../renderer/index.js';

/**
 * Register the /v1/documents/from-markdown route.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export default async function markdownRoute(app) {
  app.post('/v1/documents/from-markdown', async (request, reply) => {
    // 1. Validate
    const result = MarkdownRequestSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: result.error.issues,
      });
    }

    const { markdown, style, metadata } = result.data;

    try {
      // 2. Parse Markdown → Block[]
      const content = markdownToBlocks(markdown);

      if (content.length === 0) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Markdown produced no renderable blocks',
        });
      }

      // 3. Render
      const buffer = await renderDocument({ content, style, metadata });

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
      request.log.error(err, 'Markdown render failed');
      return reply.status(500).send({
        error: 'Render Error',
        message: err.message,
      });
    }
  });
}

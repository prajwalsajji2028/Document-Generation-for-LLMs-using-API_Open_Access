/**
 * Fastify Server — DocxForge
 *
 * Entry point: creates the Fastify app, registers middleware, mounts
 * routes, and starts listening.
 *
 * Usage:
 *   node src/server.js          # production
 *   node --watch src/server.js  # development (Node 20 --watch)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { apiKeyAuth } from './middleware/auth.js';
import { registerRateLimit } from './middleware/rateLimit.js';
import generateRoute from './routes/generate.js';
import markdownRoute from './routes/markdown.js';
import jobsRoute from './routes/jobs.js';
import healthRoute from './routes/health.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

// ---------------------------------------------------------------------------
// App factory (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Build and configure the Fastify application.
 *
 * @param {object} [opts]  Fastify constructor options (e.g. logger overrides).
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
      ...(process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty' },
      }),
    },
    // Increase body size limit for large images / base64 payloads
    bodyLimit: 50 * 1024 * 1024, // 50 MB
    ...opts,
  });

  // ── CORS ────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
  });

  // ── Rate Limiting ───────────────────────────────────────────────────────
  await registerRateLimit(app);

  // ── Auth hook ───────────────────────────────────────────────────────────
  app.addHook('preHandler', apiKeyAuth());

  // ── Routes ──────────────────────────────────────────────────────────────
  await app.register(generateRoute);
  await app.register(markdownRoute);
  await app.register(jobsRoute);
  await app.register(healthRoute);

  // ── Global error handler ────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const status = error.statusCode ?? 500;
    reply.status(status).send({
      error: error.name ?? 'Internal Server Error',
      message: error.message,
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Start server (only when run directly, not when imported for tests)
// ---------------------------------------------------------------------------

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'));

if (isDirectRun) {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`DocxForge API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      app.log.info(`${signal} received — shutting down…`);
      await app.close();
      process.exit(0);
    });
  }
}

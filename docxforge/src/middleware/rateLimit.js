/**
 * Rate Limit Middleware — DocxForge
 *
 * Per-key rate limiting using @fastify/rate-limit.
 * Limits are configurable via environment variables.
 */

import rateLimit from '@fastify/rate-limit';

/**
 * Register the rate-limit plugin on the Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export async function registerRateLimit(app) {
  const max = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
  const timeWindow = process.env.RATE_LIMIT_WINDOW ?? '1 minute';

  await app.register(rateLimit, {
    max,
    timeWindow,
    // Use API key as the rate-limit key when available; fall back to IP.
    keyGenerator: (request) => request.apiKey ?? request.ip,
    // Return standard error shape
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
      retry_after_ms: context.ttl,
    }),
  });
}

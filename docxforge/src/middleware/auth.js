/**
 * Auth Middleware — DocxForge
 *
 * Validates the X-API-Key header against a set of allowed keys.
 * Keys are loaded from the DOCXFORGE_API_KEYS environment variable
 * (comma-separated list). If the variable is unset, auth is disabled
 * (useful for local development).
 */

/**
 * Build a Fastify preHandler hook that validates API keys.
 *
 * @returns {import('fastify').preHandlerHookHandler}
 */
export function apiKeyAuth() {
  const raw = process.env.DOCXFORGE_API_KEYS ?? '';
  const allowedKeys = new Set(
    raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  );

  const authEnabled = allowedKeys.size > 0;

  return async (request, reply) => {
    // Skip auth if no keys are configured (dev mode)
    if (!authEnabled) return;

    const key = request.headers['x-api-key'];

    if (!key) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing X-API-Key header',
      });
    }

    if (!allowedKeys.has(key)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
    }

    // Attach key identifier to the request for rate-limiting
    request.apiKey = key;
  };
}

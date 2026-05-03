/**
 * Route — GET /v1/health
 *
 * Returns service health including version and queue depth.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getQueueDepth } from '../queue/producer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache the version string at module load
let cachedVersion = null;

async function getVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(
      await readFile(resolve(__dirname, '../../package.json'), 'utf-8'),
    );
    cachedVersion = pkg.version;
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion;
}

/**
 * Register the /v1/health route.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export default async function healthRoute(app) {
  app.get('/v1/health', async (_request, reply) => {
    const [version, queueDepth] = await Promise.all([
      getVersion(),
      getQueueDepth(),
    ]);

    return reply.send({
      status: 'ok',
      version,
      queue_depth: queueDepth,
    });
  });
}

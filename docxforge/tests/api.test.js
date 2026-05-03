/**
 * Integration Tests — API Endpoints
 *
 * Tests all HTTP routes using Fastify's inject() method (no real server needed).
 *
 * NOTE: Tests that involve Redis (async jobs, queue depth) are written to
 * gracefully handle Redis being unavailable — they accept 503 as a valid
 * response. All sync document-generation tests work without Redis.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';

let app;

beforeAll(async () => {
  // Build app with logger disabled for cleaner test output
  app = await buildApp({ logger: false });
}, 15000);

afterAll(async () => {
  await app.close();
}, 10000);

// ---------------------------------------------------------------------------
// GET /v1/health
// ---------------------------------------------------------------------------

describe('GET /v1/health', () => {
  it('should return 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    // queue_depth may be -1 if Redis is not available
    expect(typeof body.queue_depth).toBe('number');
  }, 15000);
});

// ---------------------------------------------------------------------------
// POST /v1/documents/generate — Sync
// ---------------------------------------------------------------------------

describe('POST /v1/documents/generate (sync)', () => {
  it('should return a .docx binary for valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [
          { type: 'heading', text: 'Test Document', level: 1 },
          { type: 'paragraph', text: 'Hello from the API test.' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    // Check PK magic bytes (ZIP / .docx)
    const buf = res.rawPayload;
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('should return 400 for empty content array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: { content: [] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Validation Error');
  });

  it('should return 400 for invalid block type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [{ type: 'video', src: 'test.mp4' }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should render with a specific preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [{ type: 'paragraph', text: 'Executive style' }],
        style: { preset: 'executive' },
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should render a table block', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [
          {
            type: 'table',
            headers: ['Name', 'Score'],
            rows: [
              ['Alice', '95'],
              ['Bob', '87'],
            ],
            style: 'bordered',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should render a list block', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [
          { type: 'list', items: ['Alpha', 'Bravo', 'Charlie'], ordered: true },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should render mixed content blocks', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [
          { type: 'heading', text: 'Report Title', level: 1 },
          { type: 'paragraph', text: 'Introduction paragraph.' },
          { type: 'heading', text: 'Data Summary', level: 2 },
          {
            type: 'table',
            headers: ['Metric', 'Value'],
            rows: [
              ['Revenue', '$1.2M'],
              ['Growth', '15%'],
            ],
          },
          { type: 'list', items: ['Key point 1', 'Key point 2'], ordered: false },
          { type: 'page_break' },
          { type: 'heading', text: 'Appendix', level: 2 },
          { type: 'paragraph', text: 'Additional details here.' },
        ],
        style: { preset: 'report' },
        metadata: { title: 'Q4 Report', author: 'Test Suite' },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(1000); // non-trivial file
  });
});

// ---------------------------------------------------------------------------
// POST /v1/documents/from-markdown
// ---------------------------------------------------------------------------

describe('POST /v1/documents/from-markdown', () => {
  it('should render Markdown to .docx', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/from-markdown',
      payload: {
        markdown: '# Hello World\n\nThis is a **test** document.\n\n- Item 1\n- Item 2',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('should return 400 for empty markdown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/from-markdown',
      payload: { markdown: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should accept style overrides', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/from-markdown',
      payload: {
        markdown: '## Section\n\nContent here.',
        style: { preset: 'academic' },
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should handle Markdown tables', async () => {
    const md = `# Report

| Name  | Score |
|-------|-------|
| Alice | 95    |
| Bob   | 87    |

Some concluding text.`;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/from-markdown',
      payload: { markdown: md },
    });

    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/documents/generate — Async (enqueue)
// ---------------------------------------------------------------------------

describe('POST /v1/documents/generate (async)', () => {
  it('should return 202 with job_id when async=true (or 503 if no Redis)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documents/generate',
      payload: {
        content: [{ type: 'paragraph', text: 'Async test' }],
        async: true,
      },
    });

    // Either 202 (Redis available) or 503 (Redis not available)
    expect([202, 503]).toContain(res.statusCode);

    if (res.statusCode === 202) {
      const body = res.json();
      expect(body.job_id).toBeDefined();
      expect(body.status).toBe('queued');
    }
  }, 15000);
});

// ---------------------------------------------------------------------------
// GET /v1/jobs/:id
// ---------------------------------------------------------------------------

describe('GET /v1/jobs/:id', () => {
  it('should return 404 or 503 for a nonexistent job', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs/nonexistent-id',
    });

    // 404 if Redis is reachable, 503 if not
    expect([404, 503]).toContain(res.statusCode);
  }, 15000);
});

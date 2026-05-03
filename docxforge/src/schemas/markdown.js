/**
 * Zod Schema — MarkdownRequest
 *
 * Validates the POST /v1/documents/from-markdown request body.
 */

import { z } from 'zod';

// Reuse the same StyleConfig shape from generate.js
const StyleConfig = z
  .object({
    preset: z.enum(['minimal', 'executive', 'report', 'academic']).optional(),
    font_family: z.string().optional(),
    font_size: z.number().min(6).max(72).optional(),
    line_spacing: z.number().min(1).max(3).optional(),
    accent_color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
  })
  .optional();

export const MarkdownRequestSchema = z.object({
  markdown: z.string().min(1, 'Markdown content must not be empty'),
  style: StyleConfig,
  metadata: z.record(z.unknown()).optional(),
});

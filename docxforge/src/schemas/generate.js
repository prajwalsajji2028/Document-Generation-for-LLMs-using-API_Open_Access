/**
 * Zod Schema — GenerateRequest
 *
 * Validates the POST /v1/documents/generate request body.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Block sub-schemas
// ---------------------------------------------------------------------------

const HeadingBlock = z.object({
  type: z.literal('heading'),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1),
});

const ParagraphBlock = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

const TableBlock = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  style: z.enum(['striped', 'bordered', 'minimal']).optional(),
});

const ImageBlock = z.object({
  type: z.literal('image'),
  src: z.string(),
  width_pct: z.number().min(1).max(100).optional(),
  caption: z.string().optional(),
});

const ListBlock = z.object({
  type: z.literal('list'),
  items: z.array(z.string()).min(1),
  ordered: z.boolean().optional(),
  indent_level: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
});

const PageBreakBlock = z.object({
  type: z.literal('page_break'),
});

/** Discriminated union of all supported block types. */
const Block = z.discriminatedUnion('type', [
  HeadingBlock,
  ParagraphBlock,
  TableBlock,
  ImageBlock,
  ListBlock,
  PageBreakBlock,
]);

// ---------------------------------------------------------------------------
// StyleConfig
// ---------------------------------------------------------------------------

const StyleConfig = z
  .object({
    preset: z.enum(['minimal', 'executive', 'report', 'academic']).optional(),
    font_family: z.string().optional(),
    font_size: z.number().min(6).max(72).optional(),
    line_spacing: z.number().min(1).max(3).optional(),
    accent_color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// PageConfig
// ---------------------------------------------------------------------------

const PageConfig = z
  .object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    margin_top: z.number().int().nonnegative().optional(),
    margin_right: z.number().int().nonnegative().optional(),
    margin_bottom: z.number().int().nonnegative().optional(),
    margin_left: z.number().int().nonnegative().optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// Top-level request schema
// ---------------------------------------------------------------------------

export const GenerateRequestSchema = z.object({
  content: z.array(Block).min(1, 'At least one content block is required'),
  style: StyleConfig,
  page: PageConfig,
  metadata: z.record(z.unknown()).optional(),
  async: z.boolean().optional().default(false),
  webhook_url: z.string().url().optional(),
});

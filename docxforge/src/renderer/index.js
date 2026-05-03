/**
 * Render Orchestrator — DocxForge
 *
 * Takes a validated GenerateRequest (blocks + style + page config),
 * assembles a docx Document, packs it into a Buffer, and returns it.
 *
 * Page defaults:
 *   - A4 (11906 × 16838 DXA)
 *   - 1-inch margins on all sides (1440 DXA)
 */

import { Document, Packer } from 'docx';
import { resolvePreset, mergeStyle } from './presets.js';
import { renderBlocks, buildNumbering } from './blocks.js';

// ---------------------------------------------------------------------------
// Constants — A4 default page geometry (DXA)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = {
  width: 11906,
  height: 16838,
  margins: {
    top: 1440,
    right: 1440,
    bottom: 1440,
    left: 1440,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a set of content blocks into a .docx Buffer.
 *
 * @param {object}   params
 * @param {object[]} params.content       Block[] to render.
 * @param {object}   [params.style]       StyleConfig overrides.
 * @param {object}   [params.page]        PageConfig overrides.
 * @param {object}   [params.metadata]    Arbitrary metadata (title, author, etc.).
 * @returns {Promise<Buffer>}             .docx file as a Node Buffer.
 */
export async function renderDocument({ content, style = {}, page = {}, metadata = {} }) {
  // 1. Resolve the design preset and merge user overrides
  const basePreset = resolvePreset(style.preset);
  const overrides = {
    fontFamily: style.font_family,
    bodySize: style.font_size ? style.font_size * 2 : undefined, // pt → half-pt
    lineSpacing: style.line_spacing,
    accentColor: style.accent_color?.replace('#', ''),
  };

  // Remove undefined properties to avoid overwriting preset defaults
  Object.keys(overrides).forEach(key => overrides[key] === undefined && delete overrides[key]);

  const preset = mergeStyle(basePreset, overrides);

  // 2. Resolve page geometry
  const pageSize = {
    width: page.width ?? DEFAULT_PAGE.width,
    height: page.height ?? DEFAULT_PAGE.height,
  };

  const pageMargins = {
    top: page.margin_top ?? DEFAULT_PAGE.margins.top,
    right: page.margin_right ?? DEFAULT_PAGE.margins.right,
    bottom: page.margin_bottom ?? DEFAULT_PAGE.margins.bottom,
    left: page.margin_left ?? DEFAULT_PAGE.margins.left,
  };

  // 3. Convert blocks → docx elements
  const children = await renderBlocks(content, preset);

  // 4. Assemble the Document
  const doc = new Document({
    numbering: buildNumbering(),
    creator: metadata.author ?? 'DocxForge',
    title: metadata.title ?? 'Untitled Document',
    description: metadata.description ?? '',
    sections: [
      {
        properties: {
          page: {
            size: pageSize,
            margin: pageMargins,
          },
        },
        children,
      },
    ],
  });

  // 5. Pack to Buffer
  return Packer.toBuffer(doc);
}

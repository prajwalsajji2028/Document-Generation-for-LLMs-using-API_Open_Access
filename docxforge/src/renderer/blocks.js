/**
 * Block Renderers — DocxForge
 *
 * Converts an array of content blocks (the DocxForge Block[] schema)
 * into an array of docx elements (Paragraph, Table, etc.) ready to be
 * placed inside a Document section.
 *
 * CRITICAL docx-js RULES enforced here:
 *  - Never use '\n' in a TextRun — use separate Paragraph elements.
 *  - Never use unicode bullets — use LevelFormat.BULLET numbering.
 *  - All sizing in DXA where applicable.
 */

import {
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  convertInchesToTwip,
} from 'docx';

import { renderTable } from './tables.js';
import { renderImage } from './images.js';

// ---------------------------------------------------------------------------
// Alignment mapping
// ---------------------------------------------------------------------------

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

// ---------------------------------------------------------------------------
// Heading level mapping
// ---------------------------------------------------------------------------

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

// ---------------------------------------------------------------------------
// Inline text parser — minimal bold/italic support
// ---------------------------------------------------------------------------

/**
 * Parse simple inline Markdown (**bold**, *italic*, ***both***) in a text
 * string and return an array of TextRun instances.
 *
 * @param {string} text      Raw text content (may include inline Markdown).
 * @param {object} baseOpts  Base TextRun options (font, size, color, etc.).
 * @returns {TextRun[]}
 */
function parseInlineText(text, baseOpts = {}) {
  if (!text) return [new TextRun({ text: '', ...baseOpts })];

  const runs = [];
  // Regex captures: ***bold+italic***, **bold**, *italic*, or plain text
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // ***bold italic***
      runs.push(new TextRun({ ...baseOpts, text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      // **bold**
      runs.push(new TextRun({ ...baseOpts, text: match[3], bold: true }));
    } else if (match[4]) {
      // *italic*
      runs.push(new TextRun({ ...baseOpts, text: match[4], italics: true }));
    } else if (match[5]) {
      // plain text
      runs.push(new TextRun({ ...baseOpts, text: match[5] }));
    }
  }

  return runs.length ? runs : [new TextRun({ text, ...baseOpts })];
}

// ---------------------------------------------------------------------------
// Individual block renderers
// ---------------------------------------------------------------------------

/**
 * Heading block → Paragraph with HeadingLevel.
 */
function renderHeading(block, preset) {
  const level = block.level ?? 1;
  const fontSize = preset.headingScale[level] ?? preset.bodySize;

  return [
    new Paragraph({
      heading: HEADING_MAP[level] ?? HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: block.text ?? '',
          font: preset.fontFamily,
          size: fontSize,
          bold: true,
          color: preset.accentColor,
        }),
      ],
    }),
  ];
}

/**
 * Paragraph block → one Paragraph per logical line (split on \n).
 * Never places '\n' inside a TextRun.
 */
function renderParagraph(block, preset) {
  const lines = (block.text ?? '').split('\n');
  const alignment = ALIGN_MAP[block.align] ?? AlignmentType.LEFT;
  const baseOpts = {
    font: preset.fontFamily,
    size: preset.bodySize,
  };

  return lines.map(
    (line) =>
      new Paragraph({
        alignment,
        spacing: { after: 120, line: Math.round(preset.lineSpacing * 240) },
        children: parseInlineText(line, baseOpts),
      }),
  );
}

/**
 * List block → one Paragraph per item with bullet / numbered numbering.
 * Uses LevelFormat.BULLET — never unicode bullets.
 */
function renderList(block, preset) {
  const { items = [], ordered = false, indent_level = 0 } = block;
  const baseOpts = {
    font: preset.fontFamily,
    size: preset.bodySize,
  };

  return items.map(
    (item) =>
      new Paragraph({
        numbering: {
          reference: ordered ? 'docxforge-ordered' : 'docxforge-bullet',
          level: indent_level,
        },
        spacing: { after: 60, line: Math.round(preset.lineSpacing * 240) },
        children: parseInlineText(item, baseOpts),
      }),
  );
}

/**
 * Page break block → single Paragraph containing a PageBreak.
 */
function renderPageBreak() {
  return [
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an array of blocks into an array of docx elements.
 *
 * @param {object[]}  blocks   Block[] from the request body.
 * @param {import('./presets').Preset} preset  Resolved design preset.
 * @returns {Promise<Array>}   Flat array of docx Paragraph / Table elements.
 */
export async function renderBlocks(blocks, preset) {
  const elements = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        elements.push(...renderHeading(block, preset));
        break;

      case 'paragraph':
        elements.push(...renderParagraph(block, preset));
        break;

      case 'table':
        elements.push(renderTable(block, preset));
        break;

      case 'image': {
        const imgElements = await renderImage(block, preset);
        elements.push(...imgElements);
        break;
      }

      case 'list':
        elements.push(...renderList(block, preset));
        break;

      case 'page_break':
        elements.push(...renderPageBreak());
        break;

      default:
        // Silently skip unknown block types for forward-compatibility
        break;
    }
  }

  return elements;
}

/**
 * Build the numbering configuration required for bullet and ordered lists.
 * This must be provided to the Document constructor.
 *
 * @returns {object}  Numbering config for docx Document.
 */
export function buildNumbering() {
  return {
    config: [
      {
        reference: 'docxforge-bullet',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
          { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.0), hanging: convertInchesToTwip(0.25) } } } },
          { level: 2, format: LevelFormat.BULLET, text: '\u25AA', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
        ],
      },
      {
        reference: 'docxforge-ordered',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
          { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.0), hanging: convertInchesToTwip(0.25) } } } },
          { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
        ],
      },
    ],
  };
}

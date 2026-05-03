/**
 * Table Renderer — DocxForge
 *
 * Renders Block.type === 'table' into docx Table elements.
 *
 * CRITICAL docx-js RULES enforced here:
 *  - Always set columnWidths[] on the Table AND width on every TableCell.
 *  - Always use WidthType.DXA — never WidthType.PERCENTAGE.
 *  - Always use ShadingType.CLEAR — never SOLID (causes black backgrounds).
 *  - Cell margins: { top: 80, bottom: 80, left: 120, right: 120 }.
 */

import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  ShadingType,
  AlignmentType,
  BorderStyle,
  TableLayoutType,
} from 'docx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default cell margins (in DXA / twentieths of a point). */
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

/** A4 printable width minus 2×1-inch margins = 11906 − 2880 = 9026 DXA. */
const PRINTABLE_WIDTH = 9026;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Distribute the printable width evenly among `count` columns.
 *
 * @param {number} count  Number of columns.
 * @returns {number[]}    Array of column widths in DXA.
 */
function equalColumnWidths(count) {
  const base = Math.floor(PRINTABLE_WIDTH / count);
  const remainder = PRINTABLE_WIDTH - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Build a minimal border definition for a single side.
 *
 * @param {string} color  Hex color (6 chars, no '#').
 * @param {number} size   Border thickness (eighth-points).
 */
function border(color = 'D1D5DB', size = 4) {
  return { style: BorderStyle.SINGLE, size, color };
}

/**
 * Create full borders object for a cell.
 *
 * @param {string} color
 */
function cellBorders(color = 'D1D5DB') {
  return {
    top: border(color),
    bottom: border(color),
    left: border(color),
    right: border(color),
  };
}

/**
 * Build a no-border object (used for 'minimal' table style).
 */
function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: none, bottom: none, left: none, right: none };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a table block into a docx `Table`.
 *
 * @param {object}  block           Table block.
 * @param {string[]} block.headers  Column header labels.
 * @param {string[][]} block.rows   2-D array of cell text.
 * @param {string}  [block.style]   'striped' | 'bordered' | 'minimal'.
 * @param {import('./presets').Preset} preset  Active design preset.
 * @returns {Table}
 */
export function renderTable(block, preset) {
  const { headers = [], rows = [], style: tableStyle = 'striped' } = block;
  const colCount = headers.length || (rows[0]?.length ?? 0);
  const colWidths = equalColumnWidths(colCount);

  // -- Header row -----------------------------------------------------------
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((text, i) =>
      buildCell(text, colWidths[i], {
        bold: true,
        font: preset.fontFamily,
        fontSize: preset.bodySize,
        fontColor: preset.tableHeaderText,
        fill: preset.tableHeaderFill,
        borders: tableStyle === 'minimal' ? noBorders() : cellBorders(preset.accentColor || 'D1D5DB'),
      }),
    ),
  });

  // -- Data rows ------------------------------------------------------------
  const dataRows = rows.map((row, rowIdx) => {
    const isAlternate = rowIdx % 2 === 1;
    return new TableRow({
      children: row.map((cellText, colIdx) =>
        buildCell(cellText, colWidths[colIdx], {
          bold: false,
          font: preset.fontFamily,
          fontSize: preset.bodySize,
          fontColor: '000000',
          fill: tableStyle === 'striped' && isAlternate ? 'F3F4F6' : 'FFFFFF',
          borders:
            tableStyle === 'minimal'
              ? noBorders()
              : cellBorders(tableStyle === 'bordered' ? (preset.accentColor || 'D1D5DB') : 'D1D5DB'),
        }),
      ),
    });
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: PRINTABLE_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
  });
}

// ---------------------------------------------------------------------------
// Internal cell builder
// ---------------------------------------------------------------------------

/**
 * Build a single TableCell with the dual-width pattern.
 *
 * @param {string} text       Cell text content.
 * @param {number} widthDxa   Column width in DXA.
 * @param {object} opts       Styling options.
 */
function buildCell(text, widthDxa, opts) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: {
      type: ShadingType.CLEAR,
      fill: opts.fill,
      color: 'auto',
    },
    borders: opts.borders,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text ?? '',
            bold: opts.bold,
            font: opts.font,
            size: opts.fontSize,
            color: opts.fontColor,
          }),
        ],
      }),
    ],
  });
}

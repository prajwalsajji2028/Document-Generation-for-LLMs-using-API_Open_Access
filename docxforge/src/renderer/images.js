/**
 * Image Renderer — DocxForge
 *
 * Handles Block.type === 'image' by resolving the source (base64 data URI
 * or HTTP(S) URL) into an ImageRun that can be placed inside a Paragraph.
 *
 * Images are centre-aligned by default and optionally captioned below.
 */

import { Paragraph, ImageRun, TextRun, AlignmentType } from 'docx';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default image width as a fraction of the A4 printable width (9026 DXA). */
const DEFAULT_WIDTH_PCT = 80;

/** A4 printable width in EMUs (9026 DXA × 635). */
const PRINTABLE_WIDTH_EMU = 9026 * 635;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a base64 data-URI into a Buffer.
 *
 * @param {string} dataUri  e.g. "data:image/png;base64,iVBOR..."
 * @returns {Buffer}
 */
function decodeDataUri(dataUri) {
  const [, base64] = dataUri.split(',');
  return Buffer.from(base64, 'base64');
}

/**
 * Fetch an image from an HTTP(S) URL and return it as a Buffer.
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Resolve image data from a src string.
 * Supports: data URIs, HTTP(S) URLs, and local file paths.
 *
 * @param {string} src
 * @returns {Promise<Buffer>}
 */
async function resolveImageData(src) {
  if (src.startsWith('data:')) return decodeDataUri(src);
  if (src.startsWith('http://') || src.startsWith('https://')) return fetchImage(src);
  // Treat as a local file path
  return readFile(resolve(src));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an image block into an array of Paragraph elements.
 * The first paragraph contains the image; the second (optional) is a caption.
 *
 * @param {object}  block
 * @param {string}  block.src        Image source (data URI, URL, or path).
 * @param {number}  [block.width_pct]  Width as percentage of printable area (1-100).
 * @param {string}  [block.caption]  Optional caption text.
 * @param {import('./presets').Preset} preset  Active design preset.
 * @returns {Promise<Paragraph[]>}
 */
export async function renderImage(block, preset) {
  const { src, width_pct = DEFAULT_WIDTH_PCT, caption } = block;

  const imageData = await resolveImageData(src);

  // Calculate pixel dimensions from percentage.
  // We use a fixed aspect-ratio placeholder (4:3) when we can't introspect
  // the binary; consumers should supply correctly-sized images.
  const widthEmu = Math.round((PRINTABLE_WIDTH_EMU * width_pct) / 100);
  const heightEmu = Math.round(widthEmu * 0.75); // 4:3 default ratio

  const paragraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: caption ? 40 : 120 },
      children: [
        new ImageRun({
          data: imageData,
          transformation: {
            width: Math.round(widthEmu / 914.4),  // EMU → points → px approx
            height: Math.round(heightEmu / 914.4),
          },
          type: 'png', // safe fallback; docx auto-detects actual format
        }),
      ],
    }),
  ];

  // Optional caption
  if (caption) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: caption,
            italics: true,
            font: preset.fontFamily,
            size: preset.bodySize - 4, // slightly smaller than body
            color: '6B7280', // gray-500
          }),
        ],
      }),
    );
  }

  return paragraphs;
}

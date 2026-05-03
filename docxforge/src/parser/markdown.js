/**
 * Markdown → Block[] Parser — DocxForge
 *
 * Converts a CommonMark string into the DocxForge Block[] format
 * using the `marked` lexer. This avoids HTML generation entirely —
 * we only need the token AST.
 */

import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a CommonMark string into a Block[] array.
 *
 * @param {string} markdown  Raw Markdown text.
 * @returns {object[]}       Array of DocxForge Block objects.
 */
export function markdownToBlocks(markdown) {
  const tokens = marked.lexer(markdown);
  return tokensToBlocks(tokens);
}

// ---------------------------------------------------------------------------
// Token → Block converters
// ---------------------------------------------------------------------------

/**
 * Recursively convert marked tokens into Block objects.
 *
 * @param {import('marked').Token[]} tokens
 * @returns {object[]}
 */
function tokensToBlocks(tokens) {
  const blocks = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        blocks.push({
          type: 'heading',
          text: extractPlainText(token.tokens),
          level: Math.min(token.depth, 4), // clamp to supported levels
        });
        break;

      case 'paragraph':
        blocks.push({
          type: 'paragraph',
          text: extractInlineText(token.tokens),
        });
        break;

      case 'list':
        blocks.push({
          type: 'list',
          items: token.items.map((item) => extractInlineText(item.tokens?.[0]?.tokens ?? item.tokens)),
          ordered: token.ordered,
          indent_level: 0,
        });
        break;

      case 'table':
        blocks.push({
          type: 'table',
          headers: token.header.map((cell) => extractPlainText(cell.tokens)),
          rows: token.rows.map((row) =>
            row.map((cell) => extractPlainText(cell.tokens)),
          ),
        });
        break;

      case 'hr':
        blocks.push({ type: 'page_break' });
        break;

      case 'code':
        // Render code blocks as paragraphs (monospace isn't ideal but
        // preserves content in the docx). Wrap each line separately.
        for (const line of (token.text ?? '').split('\n')) {
          blocks.push({ type: 'paragraph', text: line });
        }
        break;

      case 'blockquote':
        // Flatten blockquote tokens into italic paragraphs
        if (token.tokens) {
          const inner = tokensToBlocks(token.tokens);
          for (const b of inner) {
            if (b.type === 'paragraph') {
              b.text = `*${b.text}*`; // wrap in italic markers
            }
            blocks.push(b);
          }
        }
        break;

      case 'space':
        // Ignore whitespace tokens
        break;

      default:
        // Forward-compatible: skip unknown token types
        break;
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Inline text extraction
// ---------------------------------------------------------------------------

/**
 * Extract plain text from an array of inline tokens (strips formatting).
 *
 * @param {object[]} tokens
 * @returns {string}
 */
function extractPlainText(tokens) {
  if (!tokens) return '';
  return tokens.map((t) => t.text ?? t.raw ?? '').join('');
}

/**
 * Extract inline text preserving bold/italic markers for the block renderer.
 *
 * @param {object[]} tokens
 * @returns {string}
 */
function extractInlineText(tokens) {
  if (!tokens) return '';

  return tokens
    .map((t) => {
      if (t.type === 'strong') return `**${extractInlineText(t.tokens)}**`;
      if (t.type === 'em') return `*${extractInlineText(t.tokens)}*`;
      if (t.type === 'codespan') return t.text;
      if (t.type === 'link') return extractInlineText(t.tokens);
      return t.text ?? t.raw ?? '';
    })
    .join('');
}

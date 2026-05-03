/**
 * Unit Tests — Renderer
 *
 * Tests all block types, presets, and the rendering pipeline.
 */

import { describe, it, expect } from 'vitest';
import { resolvePreset, mergeStyle, PRESETS } from '../src/renderer/presets.js';
import { renderBlocks, buildNumbering } from '../src/renderer/blocks.js';
import { renderTable } from '../src/renderer/tables.js';
import { renderDocument } from '../src/renderer/index.js';
import { markdownToBlocks } from '../src/parser/markdown.js';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

describe('Presets', () => {
  it('should have four presets defined', () => {
    expect(Object.keys(PRESETS)).toEqual(['minimal', 'executive', 'report', 'academic']);
  });

  it('should resolve a known preset', () => {
    const preset = resolvePreset('executive');
    expect(preset.fontFamily).toBe('Calibri');
    expect(preset.bodySize).toBe(22);
  });

  it('should fall back to minimal for unknown names', () => {
    const preset = resolvePreset('nonexistent');
    expect(preset.fontFamily).toBe('Arial');
  });

  it('should merge overrides without losing base values', () => {
    const base = resolvePreset('report');
    const merged = mergeStyle(base, { fontFamily: 'Verdana' });
    expect(merged.fontFamily).toBe('Verdana');
    expect(merged.lineSpacing).toBe(1.5); // preserved from base
    expect(merged.headingScale[1]).toBe(56); // preserved
  });

  it('should deep-merge heading scale', () => {
    const base = resolvePreset('minimal');
    const merged = mergeStyle(base, { headingScale: { 1: 60 } });
    expect(merged.headingScale[1]).toBe(60);
    expect(merged.headingScale[2]).toBe(36); // untouched
  });
});

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

describe('Block Rendering', () => {
  const preset = resolvePreset('minimal');

  it('should render a heading block', async () => {
    const elements = await renderBlocks(
      [{ type: 'heading', text: 'Test Heading', level: 1 }],
      preset,
    );
    expect(elements).toHaveLength(1);
  });

  it('should render a paragraph block', async () => {
    const elements = await renderBlocks(
      [{ type: 'paragraph', text: 'Hello world' }],
      preset,
    );
    expect(elements).toHaveLength(1);
  });

  it('should split paragraph on newlines into separate elements', async () => {
    const elements = await renderBlocks(
      [{ type: 'paragraph', text: 'Line 1\nLine 2\nLine 3' }],
      preset,
    );
    expect(elements).toHaveLength(3);
  });

  it('should render a list block with correct count', async () => {
    const elements = await renderBlocks(
      [{ type: 'list', items: ['Item A', 'Item B', 'Item C'], ordered: false }],
      preset,
    );
    expect(elements).toHaveLength(3); // one paragraph per item
  });

  it('should render a table block', async () => {
    const elements = await renderBlocks(
      [
        {
          type: 'table',
          headers: ['Name', 'Score'],
          rows: [
            ['Alice', '95'],
            ['Bob', '87'],
          ],
        },
      ],
      preset,
    );
    expect(elements).toHaveLength(1); // single Table element
  });

  it('should render a page break', async () => {
    const elements = await renderBlocks([{ type: 'page_break' }], preset);
    expect(elements).toHaveLength(1);
  });

  it('should skip unknown block types gracefully', async () => {
    const elements = await renderBlocks(
      [{ type: 'unknown_future_type', data: {} }],
      preset,
    );
    expect(elements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

describe('Table Rendering', () => {
  const preset = resolvePreset('executive');

  it('should create a table with header + data rows', () => {
    const table = renderTable(
      {
        headers: ['Col A', 'Col B'],
        rows: [
          ['1', '2'],
          ['3', '4'],
        ],
        style: 'striped',
      },
      preset,
    );
    // The table object should exist (Table constructor returns an object)
    expect(table).toBeDefined();
  });

  it('should handle bordered style', () => {
    const table = renderTable(
      { headers: ['X'], rows: [['Y']], style: 'bordered' },
      preset,
    );
    expect(table).toBeDefined();
  });

  it('should handle minimal style', () => {
    const table = renderTable(
      { headers: ['X'], rows: [['Y']], style: 'minimal' },
      preset,
    );
    expect(table).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Numbering config
// ---------------------------------------------------------------------------

describe('Numbering Config', () => {
  it('should produce bullet and ordered list configs', () => {
    const numbering = buildNumbering();
    expect(numbering.config).toHaveLength(2);
    expect(numbering.config[0].reference).toBe('docxforge-bullet');
    expect(numbering.config[1].reference).toBe('docxforge-ordered');
  });
});

// ---------------------------------------------------------------------------
// Markdown Parser
// ---------------------------------------------------------------------------

describe('Markdown Parser', () => {
  it('should parse headings', () => {
    const blocks = markdownToBlocks('# Title\n## Subtitle');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'heading', text: 'Title', level: 1 });
    expect(blocks[1]).toEqual({ type: 'heading', text: 'Subtitle', level: 2 });
  });

  it('should parse paragraphs', () => {
    const blocks = markdownToBlocks('Hello world\n\nAnother paragraph');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1].type).toBe('paragraph');
  });

  it('should parse unordered lists', () => {
    const blocks = markdownToBlocks('- Item 1\n- Item 2\n- Item 3');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].items).toHaveLength(3);
    expect(blocks[0].ordered).toBe(false);
  });

  it('should parse ordered lists', () => {
    const blocks = markdownToBlocks('1. First\n2. Second');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].ordered).toBe(true);
  });

  it('should parse tables', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |';
    const blocks = markdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].headers).toEqual(['Name', 'Age']);
    expect(blocks[0].rows).toHaveLength(2);
  });

  it('should treat horizontal rules as page breaks', () => {
    const blocks = markdownToBlocks('---');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('page_break');
  });

  it('should preserve inline bold/italic markers', () => {
    const blocks = markdownToBlocks('This is **bold** and *italic*');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toContain('**bold**');
    expect(blocks[0].text).toContain('*italic*');
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: render to buffer
// ---------------------------------------------------------------------------

describe('Full Render Pipeline', () => {
  it('should produce a valid .docx buffer from blocks', async () => {
    const buffer = await renderDocument({
      content: [
        { type: 'heading', text: 'Integration Test', level: 1 },
        { type: 'paragraph', text: 'This is a test document.' },
        {
          type: 'table',
          headers: ['Col 1', 'Col 2'],
          rows: [['A', 'B']],
        },
        { type: 'list', items: ['One', 'Two'], ordered: true },
        { type: 'page_break' },
        { type: 'paragraph', text: 'Page two content.' },
      ],
      style: { preset: 'report' },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // .docx files are ZIP archives — they start with the PK magic bytes
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it('should render from Markdown end-to-end', async () => {
    const content = markdownToBlocks('# Hello\n\nWorld\n\n- A\n- B');
    const buffer = await renderDocument({ content });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x50);
  });

  it('should apply different presets without error', async () => {
    for (const preset of ['minimal', 'executive', 'report', 'academic']) {
      const buffer = await renderDocument({
        content: [{ type: 'paragraph', text: `Testing ${preset}` }],
        style: { preset },
      });
      expect(buffer.length).toBeGreaterThan(0);
    }
  });
});

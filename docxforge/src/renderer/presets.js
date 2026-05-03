/**
 * Design Presets — DocxForge
 *
 * Each preset defines the full typographic and color system used when
 * rendering a document. Presets are referenced by name in the StyleConfig
 * and can be partially overridden per-request.
 *
 * Units:
 *   - Font sizes are in half-points (pt × 2) for the docx library.
 *   - Line spacing is expressed as a multiplier (e.g. 1.15).
 *   - Colors are 6-char hex WITHOUT the leading '#'.
 */

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

/** @type {Record<string, import('./types').Preset>} */
export const PRESETS = {
  /**
   * Minimal — clean and compact, ideal for technical docs.
   */
  minimal: {
    fontFamily: 'Arial',
    bodySize: 22,           // 11pt × 2
    lineSpacing: 1.15,
    headingScale: {
      1: 48,                // 24pt
      2: 36,                // 18pt
      3: 28,                // 14pt
      4: 24,                // 12pt
    },
    accentColor: '000000',  // black — no accent
    tableHeaderFill: 'E5E7EB', // gray-200
    tableHeaderText: '000000',
  },

  /**
   * Executive — polished business look with subtle slate accents.
   */
  executive: {
    fontFamily: 'Calibri',
    bodySize: 22,           // 11pt
    lineSpacing: 1.25,
    headingScale: {
      1: 52,                // 26pt
      2: 40,                // 20pt
      3: 32,                // 16pt
      4: 26,                // 13pt
    },
    accentColor: '374151',  // slate-700
    tableHeaderFill: '374151',
    tableHeaderText: 'FFFFFF',
  },

  /**
   * Report — serif font with generous spacing, indigo accents.
   */
  report: {
    fontFamily: 'Georgia',
    bodySize: 22,           // 11pt
    lineSpacing: 1.50,
    headingScale: {
      1: 56,                // 28pt
      2: 44,                // 22pt
      3: 34,                // 17pt
      4: 28,                // 14pt
    },
    accentColor: '3730A3',  // indigo-800
    tableHeaderFill: '3730A3',
    tableHeaderText: 'FFFFFF',
  },

  /**
   * Academic — Times New Roman, double-spaced, no accent colors.
   */
  academic: {
    fontFamily: 'Times New Roman',
    bodySize: 24,           // 12pt
    lineSpacing: 2.0,
    headingScale: {
      1: 48,                // 24pt
      2: 40,                // 20pt
      3: 32,                // 16pt
      4: 28,                // 14pt
    },
    accentColor: '000000',  // black
    tableHeaderFill: 'D1D5DB', // gray-300
    tableHeaderText: '000000',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a preset by name, falling back to 'minimal' for unknown names.
 *
 * @param {string} [name='minimal']
 * @returns {import('./types').Preset}
 */
export function resolvePreset(name = 'minimal') {
  return PRESETS[name] ?? PRESETS.minimal;
}

/**
 * Merge a partial user style override onto a resolved preset.
 * Only the keys explicitly provided in `overrides` will replace preset values.
 *
 * @param {import('./types').Preset} preset
 * @param {Partial<import('./types').Preset>} overrides
 * @returns {import('./types').Preset}
 */
export function mergeStyle(preset, overrides = {}) {
  return {
    ...preset,
    ...overrides,
    // Deep-merge heading scale so callers can override a single level
    headingScale: {
      ...preset.headingScale,
      ...(overrides.headingScale ?? {}),
    },
  };
}

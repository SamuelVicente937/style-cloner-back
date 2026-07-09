/**
 * Groq classification types.
 *
 * `PaletteColor` is declared LOCALLY here. It structurally mirrors the
 * frontend's `analysis.types.ts` (separate repo — `style_cloner_front`) BY
 * CONVENTION, not by import — the two repos are not code-sharable.
 * `role` uses the same 10-value vocabulary as the frontend's
 * `PaletteColor.role` enum.
 */

/** CSS properties scanned for palette colors (parser scan order). */
export const COLOR_SOURCES = [
  'color',
  'background-color',
  'border-color',
] as const;

/** CSS property that produced a given hex color in the raw palette. */
export type CssColorSource = (typeof COLOR_SOURCES)[number];

/**
 * A hex color paired with the CSS properties that produced it. Preserving
 * `sources` lets `GroqService.analyze()` deterministically drop hex values
 * that only ever came from `border-color` (a computed-style artifact, not a
 * genuine visual color) without guessing from aesthetics.
 */
export interface PaletteEntry {
  hex: string;
  sources: CssColorSource[];
}

/** Semantic color roles — mirrors frontend PaletteColor.role (10 roles). */
export const COLOR_ROLES = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'text',
  'border',
  'error',
  'success',
  'warning',
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];

/** A retained palette entry classified by Groq into a semantic role. */
export interface PaletteColor {
  hex: string;
  role: ColorRole;
  variable: string; // --kebab CSS custom property name
}

export interface GroqClassifyResult {
  palette: PaletteColor[];
}

/**
 * `response_format` schema for the Groq chat completion request in
 * `GroqService.analyze()`. Wired up in Sprint 2 Phase 2 — declared here so
 * the request/response contract lives alongside the types it produces.
 */
export const GROQ_CLASSIFY_JSON_SCHEMA = {
  name: 'palette_classification',
  schema: {
    type: 'object',
    properties: {
      palette: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hex: { type: 'string' },
            role: { type: 'string', enum: COLOR_ROLES },
            variable: { type: 'string' },
          },
          required: ['hex', 'role', 'variable'],
          additionalProperties: false,
        },
      },
    },
    required: ['palette'],
    additionalProperties: false,
  },
} as const;

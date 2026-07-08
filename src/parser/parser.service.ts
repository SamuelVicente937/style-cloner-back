import { Injectable } from '@nestjs/common';
import postcss from 'postcss';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import {
  COLOR_SOURCES,
  CssColorSource,
  PaletteEntry,
} from '../groq/groq.types';

// Enables parsing CSS named colors ("red", "transparent", etc.) in addition
// to the rgb()/hsl()/hex formats colord supports out of the box.
extend([namesPlugin]);

/**
 * Typography tokens extracted from computed styles.
 * Role classification (e.g. "heading" vs "body") is Sprint 2 (Groq) work.
 */
export interface Typography {
  families: string[];
  sizes: string[];
  weights: number[];
}

/**
 * Intermediate parsed result. `palette` is a deduped list of hex colors,
 * each tagged with the CSS properties that produced it (`sources`) —
 * origin tracking that lets Groq deterministically drop `border-color`-only
 * artifacts. Assigning a semantic `role`/`variable` to each retained color
 * is Sprint 2 (Groq) work, not part of this shape.
 */
export interface ParsedStyles {
  palette: PaletteEntry[];
  typography: Typography;
  spacing: string[];
  radii: string[];
  shadows: string[];
}

/** Non-value keywords that can surface in shorthand box-model properties. */
const SHORTHAND_SKIP_TOKENS = new Set(['auto', 'none', 'normal']);

const NAMED_FONT_WEIGHTS: Record<string, number> = {
  normal: 400,
  bold: 700,
  lighter: 300,
  bolder: 700,
};

@Injectable()
export class ParserService {
  parse(rawStyles: Record<string, string[]>): ParsedStyles {
    return {
      palette: this.parsePalette(rawStyles),
      typography: this.parseTypography(rawStyles),
      spacing: this.parseSpacing(rawStyles),
      radii: this.parseRadii(rawStyles),
      shadows: this.parseShadows(rawStyles),
    };
  }

  /**
   * Groups every valid, non-transparent color value by its resolved hex,
   * recording which CSS properties (`sources`) produced it. `border-color`
   * always resolves a computed value even when an element renders no
   * visible border, so a hex whose ONLY source is `border-color` is a
   * false-positive artifact — this origin tracking is what lets
   * `GroqService.analyze()` drop those deterministically instead of
   * guessing from aesthetics.
   */
  private parsePalette(rawStyles: Record<string, string[]>): PaletteEntry[] {
    const sourcesByHex = new Map<string, Set<CssColorSource>>();

    for (const property of COLOR_SOURCES) {
      for (const value of rawStyles[property] ?? []) {
        const color = colord(value);
        if (!color.isValid()) continue;
        if (color.alpha() === 0) continue; // fully transparent — not a meaningful palette entry

        const hex = color.toHex();
        const sources = sourcesByHex.get(hex) ?? new Set<CssColorSource>();
        sources.add(property);
        sourcesByHex.set(hex, sources);
      }
    }

    return Array.from(sourcesByHex, ([hex, sources]) => ({
      hex,
      sources: Array.from(sources),
    }));
  }

  private parseTypography(rawStyles: Record<string, string[]>): Typography {
    return {
      families: this.parseFontFamilies(rawStyles['font-family'] ?? []),
      sizes: this.parseFontSizes(rawStyles['font-size'] ?? []),
      weights: this.parseFontWeights(rawStyles['font-weight'] ?? []),
    };
  }

  private parseFontFamilies(values: string[]): string[] {
    const families = new Set<string>();

    for (const value of values) {
      for (const rawFamily of postcss.list.comma(value)) {
        const family = rawFamily.trim().replace(/^['"]|['"]$/g, '');
        if (family) families.add(family);
      }
    }

    return Array.from(families);
  }

  private parseFontSizes(values: string[]): string[] {
    const sizes = new Set<string>();

    for (const value of values) {
      const trimmed = value.trim();
      if (trimmed) sizes.add(trimmed);
    }

    return Array.from(sizes).sort(
      (a, b) => parseLeadingNumber(a) - parseLeadingNumber(b),
    );
  }

  private parseFontWeights(values: string[]): number[] {
    const weights = new Set<number>();

    for (const value of values) {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) continue;

      const named = NAMED_FONT_WEIGHTS[trimmed];
      if (named !== undefined) {
        weights.add(named);
        continue;
      }

      const numeric = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(numeric)) weights.add(numeric);
    }

    return Array.from(weights).sort((a, b) => a - b);
  }

  private parseSpacing(rawStyles: Record<string, string[]>): string[] {
    const values = [
      ...(rawStyles['margin'] ?? []),
      ...(rawStyles['padding'] ?? []),
    ];
    return this.dedupeSpaceSeparatedTokens(values);
  }

  private parseRadii(rawStyles: Record<string, string[]>): string[] {
    return this.dedupeSpaceSeparatedTokens(rawStyles['border-radius'] ?? []);
  }

  private parseShadows(rawStyles: Record<string, string[]>): string[] {
    const shadows = new Set<string>();

    for (const value of rawStyles['box-shadow'] ?? []) {
      const trimmed = value.trim();
      if (!trimmed || trimmed === 'none') continue;

      for (const shadow of postcss.list.comma(trimmed)) {
        const normalized = shadow.trim();
        if (normalized) shadows.add(normalized);
      }
    }

    return Array.from(shadows);
  }

  /**
   * Splits space-separated shorthand values (e.g. "10px 20px", margin's
   * calc() forms) into individual tokens and deduplicates them across all
   * inputs. Used for margin/padding (→ spacing) and border-radius (→ radii).
   * `postcss.list.space` is used instead of a plain `.split(' ')` because it
   * correctly ignores spaces inside functions like `calc(10% + 1px)`.
   */
  private dedupeSpaceSeparatedTokens(values: string[]): string[] {
    const tokens = new Set<string>();

    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) continue;

      for (const token of postcss.list.space(trimmed)) {
        if (token && !SHORTHAND_SKIP_TOKENS.has(token)) {
          tokens.add(token);
        }
      }
    }

    return Array.from(tokens);
  }
}

function parseLeadingNumber(value: string): number {
  const match = /^(-?\d*\.?\d+)/.exec(value);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

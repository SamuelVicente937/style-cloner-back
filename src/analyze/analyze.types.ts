import { ParsedStyles } from '../parser/parser.service';
import { PaletteColor } from '../groq/groq.types';

/**
 * `ParsedStyles` with the raw `PaletteEntry[]` palette swapped for the
 * `PaletteColor[]` classification produced by `GroqService.analyze()`.
 * `typography`, `spacing`, `radii`, and `shadows` pass through unchanged.
 */
export type ClassifiedStyles = Omit<ParsedStyles, 'palette'> & {
  palette: PaletteColor[];
};

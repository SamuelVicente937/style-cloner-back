import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { ParserService } from '../parser/parser.service';
import { GroqService } from '../groq/groq.service';
import { GeneratorService } from '../generator/generator.service';
import { ClassifiedStyles } from './analyze.types';

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly scraper: ScraperService,
    private readonly parser: ParserService,
    private readonly groq: GroqService,
    private readonly generator: GeneratorService,
  ) {}

  /**
   * Sprint 1+2 pipeline: scrape raw computed styles, parse them into
   * deduped design tokens, then classify the palette into semantic
   * `{ hex, role, variable }` entries via Groq. A Groq failure propagates
   * uncaught — no partial/unclassified fallback is returned.
   *
   * Deferred to later sprints (do NOT implement here):
   * - Sprint 3: GeneratorService builds the downloadable ZIP and
   *   `downloadUrl`.
   *
   * The full `Analysis` contract (frontend `analysis.types.ts`) is only
   * assembled once that piece exists.
   */
  async analyze(url: string): Promise<ClassifiedStyles> {
    const rawStyles = await this.scraper.scrape(url);
    const parsed = this.parser.parse(rawStyles);
    const palette = await this.groq.analyze(parsed.palette);

    return { ...parsed, palette };
  }
}

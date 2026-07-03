import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { ParserService, ParsedStyles } from '../parser/parser.service';
import { GroqService } from '../groq/groq.service';
import { GeneratorService } from '../generator/generator.service';

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly scraper: ScraperService,
    private readonly parser: ParserService,
    private readonly groq: GroqService,
    private readonly generator: GeneratorService,
  ) {}

  /**
   * Sprint 1 pipeline: scrape raw computed styles and parse them into
   * deduped design tokens.
   *
   * Deferred to later sprints (do NOT implement here):
   * - Sprint 2: GroqService classifies palette colors into semantic
   *   `role`/`variable` pairs (the full `PaletteColor` shape).
   * - Sprint 3: GeneratorService builds the downloadable ZIP and
   *   `downloadUrl`.
   *
   * The full `Analysis` contract (frontend `analysis.types.ts`) is only
   * assembled once those pieces exist.
   */
  async analyze(url: string): Promise<ParsedStyles> {
    const rawStyles = await this.scraper.scrape(url);
    return this.parser.parse(rawStyles);
  }
}

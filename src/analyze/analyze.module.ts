import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { ScraperModule } from '../scraper/scraper.module';
import { ParserModule } from '../parser/parser.module';
import { GroqModule } from '../groq/groq.module';
import { GeneratorModule } from '../generator/generator.module';

@Module({
  imports: [ScraperModule, ParserModule, GroqModule, GeneratorModule],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
})
export class AnalyzeModule {}

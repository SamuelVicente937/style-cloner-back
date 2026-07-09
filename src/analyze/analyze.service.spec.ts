import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { ScraperService } from '../scraper/scraper.service';
import { ParserService, ParsedStyles } from '../parser/parser.service';
import { GroqService } from '../groq/groq.service';
import { GeneratorService } from '../generator/generator.service';
import { PaletteColor } from '../groq/groq.types';

// `ScraperService`/`GroqService` are DI-mocked below, but importing their
// real classes still pulls in `puppeteer`/`groq-sdk` at module load time.
// Neither transforms cleanly under ts-jest, so they're stubbed (mirrors
// scraper.service.spec.ts / groq.service.spec.ts).
jest.mock('puppeteer', () => ({ __esModule: true, default: {} }));
jest.mock('groq-sdk', () => ({ __esModule: true, default: jest.fn() }));

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let mockScraper: { scrape: jest.Mock };
  let mockParser: { parse: jest.Mock };
  let mockGroq: { analyze: jest.Mock };
  let mockGenerator: { generateZip: jest.Mock };

  const rawStyles: Record<string, string[]> = {
    color: ['#111111'],
    'background-color': ['#eeeeee'],
  };

  const parsedStyles: ParsedStyles = {
    palette: [
      { hex: '#111111', sources: ['color'] },
      { hex: '#eeeeee', sources: ['background-color'] },
    ],
    typography: { families: ['Inter'], sizes: ['16px'], weights: [400] },
    spacing: ['8px'],
    radii: ['4px'],
    shadows: ['0 1px 2px rgba(0, 0, 0, 0.1)'],
  };

  const classifiedPalette: PaletteColor[] = [
    { hex: '#111111', role: 'text', variable: '--color-text' },
    { hex: '#eeeeee', role: 'background', variable: '--color-background' },
  ];

  beforeEach(async () => {
    mockScraper = { scrape: jest.fn().mockResolvedValue(rawStyles) };
    mockParser = { parse: jest.fn().mockReturnValue(parsedStyles) };
    mockGroq = { analyze: jest.fn().mockResolvedValue(classifiedPalette) };
    mockGenerator = { generateZip: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        { provide: ScraperService, useValue: mockScraper },
        { provide: ParserService, useValue: mockParser },
        { provide: GroqService, useValue: mockGroq },
        { provide: GeneratorService, useValue: mockGenerator },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('scrapes, parses, then classifies the parsed palette via GroqService.analyze()', async () => {
    await service.analyze('https://example.com');

    expect(mockScraper.scrape).toHaveBeenCalledWith('https://example.com');
    expect(mockParser.parse).toHaveBeenCalledWith(rawStyles);
    expect(mockGroq.analyze).toHaveBeenCalledWith(parsedStyles.palette);
  });

  it('calls GroqService.analyze() only after ParserService.parse() has resolved', async () => {
    await service.analyze('https://example.com');

    const parseOrder = mockParser.parse.mock.invocationCallOrder[0];
    const analyzeOrder = mockGroq.analyze.mock.invocationCallOrder[0];

    expect(parseOrder).toBeLessThan(analyzeOrder);
  });

  it('returns the classified palette while passing typography/spacing/radii/shadows through unchanged', async () => {
    const result = await service.analyze('https://example.com');

    expect(result).toEqual({
      palette: classifiedPalette,
      typography: parsedStyles.typography,
      spacing: parsedStyles.spacing,
      radii: parsedStyles.radii,
      shadows: parsedStyles.shadows,
    });
  });

  it('propagates a GroqService rejection to the caller instead of falling back to the raw palette', async () => {
    const groqError = new Error(
      'Failed to classify palette via Groq: network down',
    );
    mockGroq.analyze.mockRejectedValue(groqError);

    await expect(service.analyze('https://example.com')).rejects.toThrow(
      'Failed to classify palette via Groq: network down',
    );
  });
});

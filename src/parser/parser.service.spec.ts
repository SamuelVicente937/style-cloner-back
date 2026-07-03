import { Test, TestingModule } from '@nestjs/testing';
import { ParserService } from './parser.service';

describe('ParserService', () => {
  let service: ParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParserService],
    }).compile();

    service = module.get<ParserService>(ParserService);
  });

  describe('palette', () => {
    it('normalizes rgb, hsl, and named colors to deduped hex values', () => {
      const result = service.parse({
        color: ['rgb(255, 0, 0)', 'red', '#ff0000'],
        'background-color': ['hsl(0, 0%, 100%)'],
        'border-color': [],
      });

      expect(result.palette).toEqual(
        expect.arrayContaining(['#ff0000', '#ffffff']),
      );
      expect(result.palette).toHaveLength(2);
    });

    it('drops invalid and fully transparent colors', () => {
      const result = service.parse({
        color: ['not-a-color', 'transparent', 'rgba(0, 0, 0, 0)'],
        'background-color': ['rgb(10, 20, 30)'],
        'border-color': [],
      });

      expect(result.palette).toEqual(['#0a141e']);
    });

    it('returns an empty palette for empty input', () => {
      const result = service.parse({});

      expect(result.palette).toEqual([]);
    });
  });

  describe('typography', () => {
    it('parses and dedupes font families, stripping quotes', () => {
      const result = service.parse({
        'font-family': [
          '"Inter", sans-serif',
          'Inter, sans-serif',
          "'Roboto', serif",
        ],
      });

      expect(result.typography.families).toEqual(
        expect.arrayContaining(['Inter', 'sans-serif', 'Roboto', 'serif']),
      );
      expect(result.typography.families).toHaveLength(4);
    });

    it('dedupes and sorts font sizes ascending by numeric value', () => {
      const result = service.parse({
        'font-size': ['24px', '16px', '16px', '32px'],
      });

      expect(result.typography.sizes).toEqual(['16px', '24px', '32px']);
    });

    it('normalizes named font weights and dedupes/sorts numeric weights', () => {
      const result = service.parse({
        'font-weight': ['700', 'bold', 'normal', '400', '300'],
      });

      expect(result.typography.weights).toEqual([300, 400, 700]);
    });

    it('returns empty typography arrays for empty input', () => {
      const result = service.parse({});

      expect(result.typography).toEqual({
        families: [],
        sizes: [],
        weights: [],
      });
    });
  });

  describe('spacing and radii', () => {
    it('splits shorthand margin/padding into deduped individual tokens', () => {
      const result = service.parse({
        margin: ['10px 20px'],
        padding: ['20px 0'],
      });

      expect(result.spacing).toEqual(
        expect.arrayContaining(['10px', '20px', '0']),
      );
      expect(result.spacing).toHaveLength(3);
    });

    it('ignores "auto" tokens in shorthand spacing values', () => {
      const result = service.parse({
        margin: ['0 auto'],
      });

      expect(result.spacing).toEqual(['0']);
    });

    it('does not split space inside calc() expressions', () => {
      const result = service.parse({
        margin: ['calc(10% + 1px) 5px'],
      });

      expect(result.spacing).toEqual(
        expect.arrayContaining(['calc(10% + 1px)', '5px']),
      );
      expect(result.spacing).toHaveLength(2);
    });

    it('dedupes border-radius tokens', () => {
      const result = service.parse({
        'border-radius': ['8px', '8px 8px 0 0'],
      });

      expect(result.radii).toEqual(expect.arrayContaining(['8px', '0']));
      expect(result.radii).toHaveLength(2);
    });
  });

  describe('shadows', () => {
    it('splits comma-separated shadows without breaking on rgba() internal commas', () => {
      const result = service.parse({
        'box-shadow': [
          '0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2)',
        ],
      });

      expect(result.shadows).toEqual([
        '0 1px 2px rgba(0, 0, 0, 0.1)',
        '0 2px 4px rgba(0, 0, 0, 0.2)',
      ]);
    });

    it('dedupes identical shadow definitions and ignores "none"', () => {
      const result = service.parse({
        'box-shadow': [
          '0 1px 2px rgba(0, 0, 0, 0.1)',
          'none',
          '0 1px 2px rgba(0, 0, 0, 0.1)',
        ],
      });

      expect(result.shadows).toEqual(['0 1px 2px rgba(0, 0, 0, 0.1)']);
    });

    it('returns an empty shadows list for empty input', () => {
      const result = service.parse({});

      expect(result.shadows).toEqual([]);
    });
  });
});

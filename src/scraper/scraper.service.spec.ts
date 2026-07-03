import { Test, TestingModule } from '@nestjs/testing';
import puppeteer from 'puppeteer';
import { ScraperService } from './scraper.service';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

const mockedPuppeteer = puppeteer as unknown as { launch: jest.Mock };

describe('ScraperService', () => {
  let service: ScraperService;
  let mockPage: { goto: jest.Mock; evaluate: jest.Mock };
  let mockBrowser: { newPage: jest.Mock; close: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScraperService],
    }).compile();

    service = module.get<ScraperService>(ScraperService);

    jest.clearAllMocks();

    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue({ color: ['rgb(0, 0, 0)'] }),
    };
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockedPuppeteer.launch.mockResolvedValue(mockBrowser);
  });

  it('launches a headless browser and navigates to the given URL', async () => {
    const result = await service.scrape('https://example.com');

    expect(mockedPuppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true }),
    );
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ waitUntil: 'networkidle2' }),
    );
    expect(result).toEqual({ color: ['rgb(0, 0, 0)'] });
  });

  it('closes the browser after a successful scrape', async () => {
    await service.scrape('https://example.com');

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when navigation fails', async () => {
    mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

    await expect(service.scrape('https://invalid-url')).rejects.toThrow(
      /Failed to navigate to "https:\/\/invalid-url"/,
    );
  });

  it('closes the browser even when navigation fails', async () => {
    mockPage.goto.mockRejectedValue(new Error('timeout'));

    await expect(service.scrape('https://example.com')).rejects.toThrow();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('closes the browser even when evaluate throws', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('evaluation failed'));

    await expect(service.scrape('https://example.com')).rejects.toThrow(
      'evaluation failed',
    );
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });
});

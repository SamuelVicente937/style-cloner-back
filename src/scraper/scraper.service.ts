import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';

/**
 * Element selectors sampled to build a representative snapshot of the
 * page's visual language. Kept intentionally broad but bounded per
 * selector (see MAX_ELEMENTS_PER_SELECTOR) to avoid scanning entire pages.
 */
const SELECTORS = [
  'body',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'a',
  'button',
  'header',
  'nav',
  'main',
  'section',
  'article',
  'footer',
  'div',
] as const;

/** CSS properties collected as raw computed-style strings. */
const STYLE_PROPERTIES = [
  'color',
  'background-color',
  'border-color',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'margin',
  'padding',
  'border-radius',
] as const;

const MAX_ELEMENTS_PER_SELECTOR = 25;
const NAVIGATION_TIMEOUT_MS = 30_000;

@Injectable()
export class ScraperService {
  /**
   * Launches a headless browser, navigates to `url`, and extracts raw
   * computed CSS values from a representative sample of visible DOM
   * elements. The returned record is keyed by CSS property name; values
   * may contain duplicates — deduplication and normalization happen in
   * ParserService.
   */
  async scrape(url: string): Promise<Record<string, string[]>> {
    const browser = await puppeteer.launch({ headless: true });

    try {
      const page = await browser.newPage();

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: NAVIGATION_TIMEOUT_MS,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to navigate to "${url}": ${message}`);
      }

      return await page.evaluate(
        (selectors, properties, maxElements) => {
          const collected: Record<string, string[]> = {};
          for (const property of properties) {
            collected[property] = [];
          }

          const visited = new Set<Element>();

          for (const selector of selectors) {
            const elements = Array.from(
              document.querySelectorAll(selector),
            ).slice(0, maxElements);

            for (const element of elements) {
              if (visited.has(element)) continue;
              visited.add(element);

              const rect = element.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) continue;

              const computed = window.getComputedStyle(element);
              for (const property of properties) {
                const value = computed.getPropertyValue(property);
                if (value) {
                  collected[property].push(value);
                }
              }
            }
          }

          return collected;
        },
        SELECTORS,
        STYLE_PROPERTIES,
        MAX_ELEMENTS_PER_SELECTOR,
      );
    } finally {
      await browser.close();
    }
  }
}

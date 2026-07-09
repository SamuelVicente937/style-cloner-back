import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'groq-sdk/resources/chat/completions';
import {
  COLOR_ROLES,
  GROQ_CLASSIFY_JSON_SCHEMA,
  GroqClassifyResult,
  PaletteColor,
  PaletteEntry,
} from './groq.types';

/** Groq model used for palette classification — small/fast, SDK-documented default. */
const GROQ_MODEL = 'openai/gpt-oss-20b';

const SYSTEM_PROMPT = [
  'You classify a website color palette into semantic design roles.',
  `Valid roles: ${COLOR_ROLES.join(', ')}.`,
  'Consider the full palette together so that no two entries share the same role or variable name.',
  'Respond ONLY with JSON matching this shape: {"palette":[{"hex":string,"role":string,"variable":string}]}.',
  '"variable" is a kebab-case CSS custom property name, e.g. "--color-primary".',
].join(' ');

@Injectable()
export class GroqService {
  private readonly client: Groq;

  constructor(private readonly config: ConfigService) {
    this.client = new Groq({
      apiKey: this.config.get<string>('GROQ_API_KEY'),
    });
  }

  /**
   * Classifies retained palette colors into semantic `{ hex, role, variable }`
   * entries via a single batched Groq call. Entries whose only source is
   * `border-color` are dropped BEFORE the call — they are a computed-style
   * artifact, not a genuine visual color (see parser.service.ts).
   */
  async analyze(palette: PaletteEntry[]): Promise<PaletteColor[]> {
    const retained = palette.filter((entry) => !this.isBorderOnly(entry));
    if (retained.length === 0) return [];

    const completion = await this.requestClassification(retained);
    return this.parseClassification(completion);
  }

  private isBorderOnly(entry: PaletteEntry): boolean {
    return entry.sources.length === 1 && entry.sources[0] === 'border-color';
  }

  private buildMessages(palette: PaletteEntry[]): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ palette }) },
    ];
  }

  /**
   * Requests classification with `json_schema` structured output (least
   * defensive parsing). If the request itself fails (e.g. the model/account
   * tier rejects `json_schema`), retries once with `json_object` mode before
   * giving up — mirrors `ScraperService.scrape()`'s wrap-and-propagate
   * contract for the final failure.
   */
  private async requestClassification(
    palette: PaletteEntry[],
  ): Promise<ChatCompletion> {
    const messages = this.buildMessages(palette);

    try {
      return await this.client.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: GROQ_CLASSIFY_JSON_SCHEMA,
        },
      });
    } catch {
      try {
        return await this.client.chat.completions.create({
          model: GROQ_MODEL,
          messages,
          response_format: { type: 'json_object' },
        });
      } catch (fallbackError) {
        throw this.wrapFailure(fallbackError);
      }
    }
  }

  private parseClassification(completion: ChatCompletion): PaletteColor[] {
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw this.wrapFailure(new Error('Groq response contained no content'));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw this.wrapFailure(error);
    }

    if (!isGroqClassifyResult(parsed)) {
      throw this.wrapFailure(
        new Error(
          'Groq response did not match the expected palette classification shape',
        ),
      );
    }

    return parsed.palette;
  }

  private wrapFailure(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`Failed to classify palette via Groq: ${message}`);
  }
}

function isPaletteColor(value: unknown): value is PaletteColor {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.hex === 'string' &&
    typeof candidate.variable === 'string' &&
    typeof candidate.role === 'string' &&
    (COLOR_ROLES as readonly string[]).includes(candidate.role)
  );
}

function isGroqClassifyResult(value: unknown): value is GroqClassifyResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.palette) && candidate.palette.every(isPaletteColor)
  );
}

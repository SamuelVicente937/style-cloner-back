import { Injectable } from '@nestjs/common';

@Injectable()
export class GroqService {
  async analyze(_rawTokens: object): Promise<Record<string, unknown>> {
    // TODO Sprint 2 — implement Groq API call
    throw new Error('Not implemented');
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class GeneratorService {
  async generateZip(_analysis: Record<string, unknown>): Promise<string> {
    // TODO Sprint 3 — generate files and zip
    throw new Error('Not implemented');
  }
}

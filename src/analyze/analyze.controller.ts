import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyzeService } from './analyze.service';

@Controller('api')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post('analyze')
  analyze(@Body() body: { url: string }) {
    return this.analyzeService.analyze(body.url);
  }

  @Get('download/:filename')
  download(@Param('filename') filename: string, @Res() res: Response) {
    // TODO Sprint 3 — serve generated ZIP
    res.status(501).json({ message: 'Not implemented' });
  }
}

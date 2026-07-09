import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyzeModule } from './analyze/analyze.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AnalyzeModule],
})
export class AppModule {}

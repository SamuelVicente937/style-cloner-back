import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';

@Module({
  // ConfigModule is registered globally via AppModule (isGlobal: true), but
  // imported explicitly here too so GroqModule's ConfigService dependency
  // stays discoverable when this module is tested/bootstrapped in isolation.
  imports: [ConfigModule],
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}

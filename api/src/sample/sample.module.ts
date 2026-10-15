import { Module } from '@nestjs/common';
import { AuctionsModule } from '../auctions/auctions.module';
import { ProfessionsModule } from '../professions/professions.module';
import { SampleController } from './sample.controller';
import { SampleService } from './sample.service';

@Module({
  imports: [AuctionsModule, ProfessionsModule],
  controllers: [SampleController],
  providers: [SampleService],
  exports: [SampleService],
})
export class SampleModule {}

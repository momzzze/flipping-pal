import { Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { SampleService } from './sample.service';

/** Explicitly labeled demo data. Never presented as live market data. */
@Controller('sample')
export class SampleController {
  constructor(private readonly sample: SampleService) {}

  @Post('load')
  load() {
    return this.sample.load();
  }

  @Delete()
  @HttpCode(204)
  clear() {
    return this.sample.clear();
  }
}

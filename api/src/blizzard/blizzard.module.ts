import { Global, Module } from '@nestjs/common';
import { BlizzardApiService } from './blizzard-api.service';

@Global()
@Module({
  providers: [BlizzardApiService],
  exports: [BlizzardApiService],
})
export class BlizzardModule {}

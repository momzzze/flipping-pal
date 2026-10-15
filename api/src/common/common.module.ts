import { Global, Module } from '@nestjs/common';
import { loadConfiguration, APP_CONFIG } from '../config/configuration';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    CacheService,
    { provide: APP_CONFIG, useFactory: () => loadConfiguration() },
  ],
  exports: [CacheService, APP_CONFIG],
})
export class CommonModule {}

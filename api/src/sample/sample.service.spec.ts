import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { CacheService } from '../common/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionsService } from '../professions/professions.service';
import { AuctionsService } from '../auctions/auctions.service';
import { SampleService } from './sample.service';

describe('SampleService', () => {
  it('blocks Midnight sample data in Classic Forever mode', async () => {
    const service = new SampleService(
      {} as PrismaService,
      {} as ProfessionsService,
      {} as AuctionsService,
      { isClassicForeverMode: true } as unknown as BlizzardApiService,
      {} as CacheService,
    );

    await expect(service.load()).rejects.toThrow(
      'The Midnight sample dataset is disabled in Classic Forever mode.',
    );
  });
});
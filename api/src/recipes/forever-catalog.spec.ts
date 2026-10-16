import { BadRequestException } from '@nestjs/common';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { CacheService } from '../common/cache.service';
import { ItemsService } from '../items/items.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionsService } from '../professions/professions.service';
import { RecipesService } from './recipes.service';

describe('Classic Forever catalog import', () => {
  it('rejects duplicate external recipe IDs before writing to the database', async () => {
    const transaction = jest.fn();
    const service = new RecipesService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as BlizzardApiService,
      {} as ItemsService,
      {} as ProfessionsService,
      { invalidatePrefix: jest.fn() } as unknown as CacheService,
    );
    const recipe = {
      externalId: 'recipe-1',
      name: 'Test recipe',
      outputItem: { id: 100, name: 'Test output' },
      outputQuantityMin: 1,
      outputQuantityMax: 1,
      reagents: [{ item: { id: 101, name: 'Test reagent' }, quantity: 1 }],
    };

    await expect(
      service.importClassicForeverCatalog({
        professionId: 171,
        professionName: 'Alchemy',
        skillTierId: 900001,
        skillTierName: 'Classic Forever Alchemy',
        recipes: [recipe, recipe],
      }),
    ).rejects.toThrow(new BadRequestException('Recipe externalId recipe-1 appears more than once'));
    expect(transaction).not.toHaveBeenCalled();
  });
});
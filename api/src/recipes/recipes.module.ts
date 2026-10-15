import { Module } from '@nestjs/common';
import { ItemsModule } from '../items/items.module';
import { ProfessionsModule } from '../professions/professions.module';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [ItemsModule, ProfessionsModule],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}

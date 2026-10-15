import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ProfessionsService } from './professions.service';

@Controller()
export class ProfessionsController {
  constructor(private readonly professions: ProfessionsService) {}

  @Get('professions')
  list() {
    return this.professions.list();
  }

  @Get('professions/remote')
  listRemote() {
    return this.professions.listRemote();
  }

  @Post('professions/:id/import')
  async import(@Param('id', ParseIntPipe) id: number) {
    const { profession, skillTiers } =
      await this.professions.importProfession(id);
    return {
      id: profession.id,
      name: profession.name,
      skillTiers: skillTiers.map((tier) => ({ id: tier.id, name: tier.name })),
    };
  }

  @Get('expansions')
  listExpansions() {
    return this.professions.listExpansions();
  }
}

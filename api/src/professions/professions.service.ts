import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Profession, SkillTier } from '@prisma/client';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { deriveExpansionName, slugify } from './expansion-utils';

export interface ProfessionDto {
  id: number;
  name: string;
  iconUrl: string | null;
  source: DataSource;
  recipeCount: number;
  skillTiers: Array<{
    id: number;
    name: string;
    expansionId: number | null;
    expansionName: string | null;
    recipeCount: number;
  }>;
}

export interface ExpansionDto {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

@Injectable()
export class ProfessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
  ) {}

  async list(): Promise<ProfessionDto[]> {
    const professions = await this.prisma.profession.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { recipes: true } },
        skillTiers: {
          orderBy: { id: 'desc' },
          include: { expansion: true, _count: { select: { recipes: true } } },
        },
      },
    });
    return professions.map((profession) => ({
      id: profession.id,
      name: profession.name,
      iconUrl: profession.iconUrl,
      source: profession.source,
      recipeCount: profession._count.recipes,
      skillTiers: profession.skillTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        expansionId: tier.expansionId,
        expansionName: tier.expansion?.name ?? null,
        recipeCount: tier._count.recipes,
      })),
    }));
  }

  async listExpansions(): Promise<ExpansionDto[]> {
    const expansions = await this.prisma.expansion.findMany({
      orderBy: { sortOrder: 'desc' },
    });
    return expansions.map(({ id, slug, name, sortOrder }) => ({
      id,
      slug,
      name,
      sortOrder,
    }));
  }

  /** Lists professions available from Blizzard (does not persist). */
  async listRemote(): Promise<Array<{ id: number; name: string }>> {
    const index = await this.blizzard.getProfessionIndex();
    return index.professions.map((p) => ({
      id: p.id,
      name: p.name ?? `Profession ${p.id}`,
    }));
  }

  async upsertExpansion(name: string, sortOrder: number): Promise<number> {
    const slug = slugify(name);
    const expansion = await this.prisma.expansion.upsert({
      where: { slug },
      create: { slug, name, sortOrder },
      update: {},
    });
    if (sortOrder > expansion.sortOrder) {
      await this.prisma.expansion.update({
        where: { id: expansion.id },
        data: { sortOrder },
      });
    }
    return expansion.id;
  }

  /** Imports a profession and its skill tiers (expansion branches) from Blizzard. */
  async importProfession(
    professionId: number,
  ): Promise<{ profession: Profession; skillTiers: SkillTier[] }> {
    const remote = await this.blizzard.getProfession(professionId);
    if (!remote)
      throw new NotFoundException(`Profession ${professionId} not found`);
    const media = await this.blizzard
      .getProfessionMedia(professionId)
      .catch(() => null);
    const iconUrl =
      media?.assets?.find((asset) => asset.key === 'icon')?.value ?? null;

    const profession = await this.prisma.profession.upsert({
      where: { id: remote.id },
      create: {
        id: remote.id,
        name: remote.name,
        iconUrl,
        source: DataSource.BLIZZARD,
      },
      update: { name: remote.name, iconUrl, source: DataSource.BLIZZARD },
    });

    const skillTiers: SkillTier[] = [];
    for (const tier of remote.skill_tiers ?? []) {
      const tierName = tier.name ?? `Skill tier ${tier.id}`;
      const expansionId = await this.upsertExpansion(
        deriveExpansionName(
          tierName,
          remote.name,
          this.blizzard.targetExpansionName,
        ),
        tier.id,
      );
      skillTiers.push(
        await this.prisma.skillTier.upsert({
          where: { id: tier.id },
          create: {
            id: tier.id,
            name: tierName,
            professionId: remote.id,
            expansionId,
          },
          update: { name: tierName, professionId: remote.id, expansionId },
        }),
      );
    }
    return { profession, skillTiers };
  }
}

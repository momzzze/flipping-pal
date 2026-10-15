-- CreateEnum
CREATE TYPE "Region" AS ENUM ('EU', 'US', 'KR', 'TW');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('BLIZZARD', 'MANUAL', 'SAMPLE');

-- CreateEnum
CREATE TYPE "AuctionScope" AS ENUM ('COMMODITY', 'REALM');

-- CreateEnum
CREATE TYPE "ItemQuality" AS ENUM ('POOR', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ARTIFACT', 'HEIRLOOM', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Expansion" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expansion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "source" "DataSource" NOT NULL DEFAULT 'BLIZZARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillTier" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "expansionId" INTEGER,
    "minSkill" INTEGER,
    "maxSkill" INTEGER,
    "source" "DataSource" NOT NULL DEFAULT 'BLIZZARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quality" "ItemQuality" NOT NULL DEFAULT 'UNKNOWN',
    "iconUrl" TEXT,
    "itemClass" TEXT,
    "itemSubclass" TEXT,
    "isCommodity" BOOLEAN NOT NULL DEFAULT true,
    "craftingQuality" INTEGER,
    "qualityGroupKey" TEXT,
    "vendorBuyPrice" BIGINT,
    "vendorSellPrice" BIGINT,
    "source" "DataSource" NOT NULL DEFAULT 'BLIZZARD',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "blizzardRecipeId" INTEGER,
    "name" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "skillTierId" INTEGER,
    "category" TEXT,
    "outputItemId" INTEGER,
    "outputQuantityMin" INTEGER NOT NULL DEFAULT 1,
    "outputQuantityMax" INTEGER NOT NULL DEFAULT 1,
    "multicraftEligible" BOOLEAN NOT NULL DEFAULT false,
    "resourcefulnessEligible" BOOLEAN NOT NULL DEFAULT false,
    "concentrationEligible" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "source" "DataSource" NOT NULL DEFAULT 'BLIZZARD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeReagent" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "slotId" INTEGER,
    "affectedByResourcefulness" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecipeReagent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedRealm" (
    "id" INTEGER NOT NULL,
    "region" "Region" NOT NULL,
    "name" TEXT NOT NULL,
    "realmSlugs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedRealm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionSnapshot" (
    "id" SERIAL NOT NULL,
    "region" "Region" NOT NULL,
    "scope" "AuctionScope" NOT NULL,
    "connectedRealmId" INTEGER,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "sourceLastModified" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionCount" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuctionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPriceSnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "minUnitPrice" BIGINT NOT NULL,
    "marketUnitPrice" BIGINT NOT NULL,
    "medianUnitPrice" BIGINT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "listingCount" INTEGER NOT NULL,
    "priceTiers" JSONB NOT NULL,

    CONSTRAINT "ItemPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "note" TEXT,
    "targetProfit" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraftingModifierProfile" (
    "id" SERIAL NOT NULL,
    "professionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "multicraftChance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "multicraftYieldBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resourcefulnessChance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resourcefulnessSavings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftingModifierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expansion_slug_key" ON "Expansion"("slug");

-- CreateIndex
CREATE INDEX "SkillTier_professionId_idx" ON "SkillTier"("professionId");

-- CreateIndex
CREATE INDEX "SkillTier_expansionId_idx" ON "SkillTier"("expansionId");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE INDEX "Item_qualityGroupKey_idx" ON "Item"("qualityGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_blizzardRecipeId_key" ON "Recipe"("blizzardRecipeId");

-- CreateIndex
CREATE INDEX "Recipe_professionId_idx" ON "Recipe"("professionId");

-- CreateIndex
CREATE INDEX "Recipe_skillTierId_idx" ON "Recipe"("skillTierId");

-- CreateIndex
CREATE INDEX "RecipeReagent_itemId_idx" ON "RecipeReagent"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeReagent_recipeId_itemId_key" ON "RecipeReagent"("recipeId", "itemId");

-- CreateIndex
CREATE INDEX "AuctionSnapshot_region_scope_connectedRealmId_fetchedAt_idx" ON "AuctionSnapshot"("region", "scope", "connectedRealmId", "fetchedAt");

-- CreateIndex
CREATE INDEX "ItemPriceSnapshot_itemId_idx" ON "ItemPriceSnapshot"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPriceSnapshot_snapshotId_itemId_key" ON "ItemPriceSnapshot"("snapshotId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_recipeId_key" ON "WatchlistEntry"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "CraftingModifierProfile_professionId_name_key" ON "CraftingModifierProfile"("professionId", "name");

-- AddForeignKey
ALTER TABLE "SkillTier" ADD CONSTRAINT "SkillTier_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTier" ADD CONSTRAINT "SkillTier_expansionId_fkey" FOREIGN KEY ("expansionId") REFERENCES "Expansion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_skillTierId_fkey" FOREIGN KEY ("skillTierId") REFERENCES "SkillTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReagent" ADD CONSTRAINT "RecipeReagent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReagent" ADD CONSTRAINT "RecipeReagent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPriceSnapshot" ADD CONSTRAINT "ItemPriceSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AuctionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPriceSnapshot" ADD CONSTRAINT "ItemPriceSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftingModifierProfile" ADD CONSTRAINT "CraftingModifierProfile_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

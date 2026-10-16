/*
  Warnings:

  - A unique constraint covering the columns `[source,externalId]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "DataSource" ADD VALUE 'FOREVER_BETA';

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_source_externalId_key" ON "Recipe"("source", "externalId");

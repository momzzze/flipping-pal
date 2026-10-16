ALTER TYPE "DataSource" ADD VALUE 'CLASSIC_FOREVER_SCAN';

ALTER TABLE "AuctionSnapshot"
ADD COLUMN "source" "DataSource" NOT NULL DEFAULT 'BLIZZARD',
ADD COLUMN "sourceScanId" TEXT;

CREATE UNIQUE INDEX "AuctionSnapshot_source_sourceScanId_key"
ON "AuctionSnapshot"("source", "sourceScanId");
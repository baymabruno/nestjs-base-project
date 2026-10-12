-- AlterTable
ALTER TABLE "hero_talent_stats" DROP CONSTRAINT "hero_talent_stats_pkey",
ADD COLUMN     "position" SMALLINT NOT NULL DEFAULT 0,
ADD CONSTRAINT "hero_talent_stats_pkey" PRIMARY KEY ("hero_id", "position", "ability_id");

-- CreateTable
CREATE TABLE "hero_role_item_timings" (
    "hero_id" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "item_id" SMALLINT NOT NULL,
    "minute" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_role_item_timings_pkey" PRIMARY KEY ("hero_id","position","item_id","minute")
);

-- CreateTable
CREATE TABLE "hero_role_starting_items" (
    "hero_id" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "item_id" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_role_starting_items_pkey" PRIMARY KEY ("hero_id","position","item_id")
);


-- CreateTable
CREATE TABLE "hero_matchup_stats" (
    "patch_id" SMALLINT NOT NULL,
    "source" "match_source" NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "other_hero_id" SMALLINT NOT NULL,
    "ally" BOOLEAN NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_matchup_stats_pkey" PRIMARY KEY ("patch_id","source","hero_id","other_hero_id","ally")
);

-- CreateTable
CREATE TABLE "hero_item_timing_stats" (
    "patch_id" SMALLINT NOT NULL,
    "source" "match_source" NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "item_id" SMALLINT NOT NULL,
    "bucket" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "time_sum" BIGINT NOT NULL,

    CONSTRAINT "hero_item_timing_stats_pkey" PRIMARY KEY ("patch_id","source","hero_id","item_id","bucket")
);

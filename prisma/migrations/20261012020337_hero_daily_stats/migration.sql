-- CreateTable
CREATE TABLE "hero_daily_stats" (
    "patch_id" SMALLINT NOT NULL,
    "day" DATE NOT NULL,
    "source" "match_source" NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "duration_bucket" SMALLINT NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_daily_stats_pkey" PRIMARY KEY ("patch_id","day","source","rank_bracket","duration_bucket","hero_id")
);

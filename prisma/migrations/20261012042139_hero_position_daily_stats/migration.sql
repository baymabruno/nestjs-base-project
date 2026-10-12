-- CreateTable
CREATE TABLE "hero_position_daily_stats" (
    "day" DATE NOT NULL,
    "position" SMALLINT NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_position_daily_stats_pkey" PRIMARY KEY ("day","position","rank_bracket","hero_id")
);

-- CreateTable
CREATE TABLE "hero_stats" (
    "patch_id" SMALLINT NOT NULL,
    "source" "match_source" NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hero_stats_pkey" PRIMARY KEY ("patch_id","source","hero_id")
);

-- CreateTable
CREATE TABLE "hero_item_stats" (
    "patch_id" SMALLINT NOT NULL,
    "source" "match_source" NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "item_id" SMALLINT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "purchase_time_sum" BIGINT NOT NULL,
    "purchase_time_count" INTEGER NOT NULL,

    CONSTRAINT "hero_item_stats_pkey" PRIMARY KEY ("patch_id","source","hero_id","item_id")
);

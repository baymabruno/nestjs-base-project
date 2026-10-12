-- CreateEnum
CREATE TYPE "match_source" AS ENUM ('PRO', 'PUBLIC');

-- CreateEnum
CREATE TYPE "details_status" AS ENUM ('PENDING', 'FETCHED', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "heroes" (
    "id" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "localized_name" TEXT NOT NULL,
    "primary_attr" TEXT NOT NULL,
    "roles" TEXT[],

    CONSTRAINT "heroes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "cost" INTEGER,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patches" (
    "id" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "released_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" BIGINT NOT NULL,
    "source" "match_source" NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "duration" INTEGER NOT NULL,
    "radiant_win" BOOLEAN NOT NULL,
    "patch_id" SMALLINT NOT NULL,
    "avg_rank_tier" SMALLINT,
    "league_id" INTEGER,
    "details_status" "details_status" NOT NULL DEFAULT 'PENDING',
    "details_attempts" SMALLINT NOT NULL DEFAULT 0,
    "details_after" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "match_id" BIGINT NOT NULL,
    "player_slot" SMALLINT NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "win" BOOLEAN NOT NULL,
    "source" "match_source" NOT NULL,
    "patch_id" SMALLINT NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "account_id" BIGINT,
    "kills" SMALLINT,
    "deaths" SMALLINT,
    "assists" SMALLINT,
    "items" SMALLINT[],
    "neutral_item_id" SMALLINT,
    "purchase_items" SMALLINT[],
    "purchase_times" INTEGER[],

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("match_id","player_slot")
);

-- CreateIndex
CREATE UNIQUE INDEX "heroes_name_key" ON "heroes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_name_key" ON "items"("name");

-- CreateIndex
CREATE INDEX "matches_start_time_idx" ON "matches"("start_time");

-- CreateIndex
CREATE INDEX "matches_details_status_details_after_idx" ON "matches"("details_status", "details_after");

-- CreateIndex
CREATE INDEX "match_players_patch_id_hero_id_idx" ON "match_players"("patch_id", "hero_id");

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

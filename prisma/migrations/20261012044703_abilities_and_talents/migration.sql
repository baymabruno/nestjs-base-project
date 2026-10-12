-- AlterTable
ALTER TABLE "match_players" ADD COLUMN     "ability_upgrades" INTEGER[];

-- CreateTable
CREATE TABLE "abilities" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "is_talent" BOOLEAN NOT NULL,

    CONSTRAINT "abilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_talents" (
    "hero_id" SMALLINT NOT NULL,
    "ability_id" INTEGER NOT NULL,
    "tier" SMALLINT NOT NULL,
    "slot" SMALLINT NOT NULL,

    CONSTRAINT "hero_talents_pkey" PRIMARY KEY ("hero_id","ability_id")
);

-- CreateTable
CREATE TABLE "hero_skill_build_stats" (
    "patch_id" SMALLINT NOT NULL,
    "source" "match_source" NOT NULL,
    "hero_id" SMALLINT NOT NULL,
    "build" TEXT NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "hero_skill_build_stats_pkey" PRIMARY KEY ("patch_id","source","hero_id","build")
);

-- CreateTable
CREATE TABLE "hero_talent_stats" (
    "hero_id" SMALLINT NOT NULL,
    "ability_id" INTEGER NOT NULL,
    "matches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hero_talent_stats_pkey" PRIMARY KEY ("hero_id","ability_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "abilities_name_key" ON "abilities"("name");

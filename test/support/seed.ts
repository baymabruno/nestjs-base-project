import { GameDataService } from '../../src/game-data/game-data.service.js';
import { MatchesService } from '../../src/matches/matches.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { StatsService } from '../../src/stats/stats.service.js';
import {
  fakeOpenDota,
  matchDetails,
  proMatch,
  publicMatch,
} from './opendota-fakes.js';

/**
 * Stores the game data, two public matches won by radiant (hero 1) against
 * dire (hero 2) and one parsed pro match lost by radiant (heroes 1 and 2),
 * then calculates the statistics.
 */
export async function seedStats(prisma: PrismaService) {
  const gameData = new GameDataService(prisma, fakeOpenDota());
  await gameData.sync();
  const matches = new MatchesService(prisma, gameData);

  await matches.addPublicMatches([
    publicMatch({ match_id: 1, radiant_win: true }),
    publicMatch({ match_id: 2, radiant_win: true }),
  ]);
  await matches.addProMatches([proMatch({ match_id: 3 })]);
  const [pro] = await matches.findPendingDetails(1);
  await matches.saveDetails(pro, matchDetails(3, { radiantWin: false }));

  await new StatsService(prisma).refresh(gameData.currentPatch().id);
}

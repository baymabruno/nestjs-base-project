import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';
import { seedStats } from './support/seed.js';

// statistics routes, read from a database with known matches
describe('Stats (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedStats(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/meta (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/meta')
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          patch: { name: '7.41' },
          matches: { pro: 1, public: 2 },
        }),
      );
  });

  it('/api/v1/heroes (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes?source=public&minMatches=2')
      .expect(200)
      .expect((res) => {
        expect(res.body.patch.name).toBe('7.41');
        expect(res.body.heroes[0]).toMatchObject({
          id: 1,
          matches: 2,
          winRate: 1,
        });
      });
  });

  it('/api/v1/heroes/:heroId (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes/1?minItemCost=3000')
      .expect(200)
      .expect((res) => {
        expect(res.body.hero.localizedName).toBe('Anti-Mage');
        expect(res.body.items).toEqual([
          expect.objectContaining({ name: 'bfury', avgPurchaseTime: 600 }),
        ]);
      });
  });

  it('/api/v1/meta/heroes (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/meta/heroes?days=30&source=public')
      .expect(200)
      .expect((res) => {
        expect(res.body.patch.name).toBe('7.41');
        expect(res.body.heroes[0]).toMatchObject({
          id: 1,
          matches: 2,
          winRate: 1,
          durations: { short: { matches: 0, winRate: null } },
        });
        expect(res.body.heroes[0].daily).toHaveLength(30);
      });
  });

  it.each(['days=0', 'days=31', 'bracket=herald'])(
    'rejects an invalid meta filter: %s',
    async (filter) => {
      await request(app.getHttpServer())
        .get(`/api/v1/meta/heroes?${filter}`)
        .expect(400);
    },
  );

  it('/api/v1/heroes/:heroId/matchups (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes/1/matchups?source=public')
      .expect(200)
      .expect((res) => {
        expect(res.body.hero).toMatchObject({ id: 1, matches: 2, winRate: 1 });
        expect(res.body.enemies[0]).toMatchObject({ id: 2, matches: 2 });
      });
  });

  it('/api/v1/heroes/:heroId/item-timings (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes/1/item-timings?minItemCost=3000')
      .expect(200)
      .expect((res) => {
        expect(res.body.matches).toBe(1);
        expect(res.body.items).toEqual([
          expect.objectContaining({ name: 'bfury', avgTime: 600 }),
        ]);
      });
  });

  it('returns 404 for the matchups of an unknown hero', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes/999/matchups')
      .expect(404);
  });

  it('/api/v1/meta/roles (GET) without data', () => {
    return request(app.getHttpServer())
      .get('/api/v1/meta/roles?position=1')
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ available: false, heroes: [] }),
      );
  });

  it('rejects an invalid position', () => {
    return request(app.getHttpServer())
      .get('/api/v1/meta/roles?position=6')
      .expect(400);
  });

  it('rejects invalid filters', () => {
    return request(app.getHttpServer())
      .get('/api/v1/heroes?source=ranked')
      .expect(400);
  });

  it('returns 404 for an unknown hero', () => {
    return request(app.getHttpServer()).get('/api/v1/heroes/999').expect(404);
  });
});

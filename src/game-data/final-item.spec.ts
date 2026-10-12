import { isFinalItem } from './game-data.service.js';

describe('isFinalItem', () => {
  const usedInRecipes = new Set(['ogre_axe', 'blink', 'boots']);
  const item = (fields: object) => ({ id: 1, cost: 1000, ...fields });

  it('accepts the items assembled from a recipe', () => {
    expect(
      isFinalItem(
        'phase_boots',
        item({ components: ['boots'] }),
        usedInRecipes,
      ),
    ).toBe(true);
  });

  it('accepts a basic item that is not part of any recipe', () => {
    expect(
      isFinalItem('aghanims_shard', item({ qual: 'rare' }), usedInRecipes),
    ).toBe(true);
  });

  it('accepts the Blink Dagger, a component of its upgrades', () => {
    expect(isFinalItem('blink', item({}), usedInRecipes)).toBe(true);
  });

  it('leaves out components, consumables, recipes and free items', () => {
    expect(isFinalItem('ogre_axe', item({}), usedInRecipes)).toBe(false);
    expect(
      isFinalItem('tango', item({ qual: 'consumable' }), usedInRecipes),
    ).toBe(false);
    expect(isFinalItem('recipe_bfury', item({}), usedInRecipes)).toBe(false);
    expect(
      isFinalItem(
        'ward_dispenser',
        item({ components: ['ward_observer', 'ward_sentry'] }),
        usedInRecipes,
      ),
    ).toBe(false);
    expect(
      isFinalItem('mysterious_hat', item({ cost: 0 }), usedInRecipes),
    ).toBe(false);
  });
});

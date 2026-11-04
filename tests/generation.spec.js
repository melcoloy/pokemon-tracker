// Règles propres à chaque génération : types, table des types, stats, talents.
const { test, expect, selectGame } = require('./fixtures');

test('Rouge (gén. 1) : table des types et types des Pokémon d\'époque', async ({ page }) => {
    const options = await page.$$eval('#atk-type-select option', o => o.map(x => x.value).filter(Boolean));
    expect(options).not.toContain('fairy');
    expect(options).not.toContain('steel');
    expect(options).not.toContain('dark');

    const calc = (atk, def) => page.evaluate(([a, d]) => getMultiplier(a, d), [atk, def]);
    expect(await calc('ghost', 'psychic')).toBe(0);
    expect(await calc('ice', 'fire')).toBe(1);
    expect(await calc('bug', 'poison')).toBe(2);
    expect(await calc('poison', 'bug')).toBe(2);

    expect(await page.evaluate(() => nameToPoke.clefairy.frenchTypes)).toEqual(['Normal']);
    expect(await page.evaluate(() => nameToPoke.magnemite.frenchTypes)).toEqual(['Électrik']);
});

test('Or (gén. 2) : l\'Acier résiste au Spectre, Magnéti devient Électrik / Acier', async ({ page }) => {
    await selectGame(page, 'gold');
    expect(await page.evaluate(() => getMultiplier('ghost', 'steel'))).toBe(0.5);
    expect(await page.evaluate(() => nameToPoke.magnemite.frenchTypes)).toEqual(['Électrik', 'Acier']);
});

test('Stats : une seule stat Spécial en gén. 1, anciennes valeurs avant la gén. 6', async ({ page }) => {
    const stats = () => page.evaluate(() => Object.fromEntries(nameToPoke.pikachu.stats.map(s => [s.stat.name, s.base_stat])));
    expect(await stats()).toMatchObject({ special: 50, defense: 30 });
    expect(Object.keys(await stats())).not.toContain('special-attack');

    await selectGame(page, 'x');
    expect(await stats()).toMatchObject({ defense: 40, 'special-defense': 50 });
});

test('Talents : absents en gén. 1-2, pas de talent caché avant la gén. 5, anciens talents', async ({ page }) => {
    const abilities = species => page.evaluate(s => nameToPoke[s].abilities.map(a => a.name + (a.isHidden ? '*' : '')), species);
    expect(await abilities('pikachu')).toEqual([]);

    await selectGame(page, 'firered');
    expect(await abilities('gengar')).toEqual(['levitate']);

    await selectGame(page, 'platinum');
    expect(await abilities('zubat')).toEqual(['inner-focus']);

    await selectGame(page, 'black-2');
    expect(await abilities('zubat')).toEqual(['inner-focus', 'infiltrator*']);

    await selectGame(page, 'sun');
    expect(await abilities('gengar')).toEqual(['cursed-body']);
});

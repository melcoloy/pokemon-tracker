// Données locales : zones, exclusivités, évolutions, capacités, descriptions, numéros régionaux.
const fs = require('fs');
const path = require('path');
const { test, expect, selectGame } = require('./fixtures');

const GAMES = ['red', 'yellow', 'firered', 'lets-go-pikachu', 'gold', 'crystal', 'heartgold', 'ruby', 'emerald',
    'omega-ruby', 'diamond', 'platinum', 'brilliant-diamond', 'black', 'black-2', 'x', 'sun', 'ultra-sun',
    'sword', 'legends-arceus', 'scarlet'];

test('chaque jeu de la liste a ses deux fichiers de données', async ({ page }) => {
    const options = await page.$$eval('#game-select option', o => o.map(x => x.value));
    expect(options.sort()).toEqual([...GAMES].sort());
    for (const slug of GAMES) {
        for (const file of [`data/${slug}.json`, `data/extra/${slug}.json`]) {
            expect(fs.existsSync(path.join(__dirname, '..', file)), file).toBe(true);
        }
    }
});

test('aucun appel à PokéAPI quand les fichiers locaux sont présents', async ({ page, apiCalls }) => {
    await page.click('#tab-specificities');
    await page.evaluate(() => selectPokemonInStats(nameToPoke.pikachu.id));
    await selectGame(page, 'sword');
    expect(apiCalls).toEqual([]);
});

test('zones de rencontre et exclusivités de version', async ({ page }) => {
    expect(await page.$$eval('#location-filter option', o => o.length)).toBeGreaterThan(40);
    await page.click('#tab-specificities');
    const exclusives = await page.textContent('#version-exclusives');
    expect(exclusives).toContain('Exclusifs Rouge');
    expect(exclusives).toContain('Abo');      // Abo : exclusif Rouge
    expect(exclusives).toContain('Sabelette'); // Sabelette : exclusif Bleu

    await selectGame(page, 'scarlet');
    await expect(page.locator('#location-filter')).toBeDisabled();
});

test('conditions d\'évolution propres au jeu', async ({ page }) => {
    const leafeon = () => page.evaluate(() => describeEvolutionForGame('leafeon'));
    await selectGame(page, 'platinum');
    expect(await leafeon()).toContain('Forêt Vestigion');
    await selectGame(page, 'sword');
    expect(await leafeon()).toContain('Pierre Plante');
});

test('capacités : valeurs de la génération, numéros de CT, descriptions', async ({ page }) => {
    expect(await page.evaluate(() => gameExtra.moves.bite[0])).toBe('normal');
    expect(await page.evaluate(() => gameExtra.machines.thunderbolt)).toBe('CT24');

    await page.evaluate(() => selectPokemonInStats(nameToPoke.pikachu.id));
    await expect(page.locator('.moves-table').first()).toBeVisible();
    await expect(page.locator('.move-desc').first()).toBeHidden();
    await page.check('#show-move-descriptions');
    await expect(page.locator('.move-desc').first()).toBeVisible();
    await expect(page.locator('#stats-description')).toContainText('(texte de Pokémon Noir');
});

test('numéros du Pokédex régional', async ({ page }) => {
    await expect(page.locator('#pokedex-list .pokemon-card').first()).toContainText('#001');
    await selectGame(page, 'x');
    await expect(page.locator('#pokedex-list .pokemon-card').first()).toContainText('Kalos : Centre #001');
});

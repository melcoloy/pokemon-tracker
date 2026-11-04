// Mon Équipe : une équipe par jeu, talents et capacités, analyse, suggestions, générateur.
const { test, expect, selectGame, addToTeam, analysisRow } = require('./fixtures');

test('une équipe par jeu, conservée après rechargement, ancienne équipe reprise', async ({ page }) => {
    await page.evaluate(() => {
        localStorage.setItem('userTeam', JSON.stringify([{ id: 25, name: 'Pikachu', image: '', types: ['Électrik'] }]));
        localStorage.removeItem('userTeams');
    });
    await page.reload();
    await page.waitForFunction(() => !gameSelect.disabled && allPokemon.length > 0);
    expect(await page.evaluate(() => userTeam.map(m => m.id))).toEqual([25]);
    expect(await page.evaluate(() => localStorage.getItem('userTeam'))).toBeNull();

    await selectGame(page, 'platinum');
    expect(await page.evaluate(() => userTeam.length)).toBe(0);
    await addToTeam(page, 'eevee');

    await page.reload();
    await page.waitForFunction(() => !gameSelect.disabled && allPokemon.length > 0);
    expect(await page.evaluate(() => gameSelect.value)).toBe('platinum');
    expect(await page.evaluate(() => teamsByGame.red.map(m => m.id))).toEqual([25]);
    expect(await page.evaluate(() => userTeam.map(m => m.pokemonName))).toEqual(['eevee']);
});

test('analyse : table des types de Rouge, faiblesses ×4 et immunités', async ({ page }) => {
    await addToTeam(page, 'alakazam', 'charizard');
    await page.click('#tab-mon-equipe');
    expect(await analysisRow(page, 0, 'Spectre')).toEqual(['×0', '·', '·', '1']);
    expect(await analysisRow(page, 0, 'Roche')).toEqual(['·', '×4', '1', '·']);
    expect(await analysisRow(page, 0, 'Fée')).toBeNull();
});

test('talents : Lévitation et Paratonnerre changent les dégâts subis', async ({ page }) => {
    await selectGame(page, 'x');
    await addToTeam(page, 'gengar', 'pikachu');
    await page.click('#tab-mon-equipe');
    expect((await analysisRow(page, 0, 'Sol'))[0]).toBe('×0*');

    await page.locator('.team-slot').nth(1).locator('summary').click();
    await page.locator('.team-slot').nth(1).locator('select[data-field="ability"]').selectOption('lightning-rod');
    expect((await analysisRow(page, 0, 'Électrik'))[1]).toBe('×0*');
});

test('capacités choisies : couverture offensive et sauvegarde', async ({ page }) => {
    await selectGame(page, 'x');
    await addToTeam(page, 'charizard');
    await page.click('#tab-mon-equipe');
    await page.locator('.team-slot summary').click();
    const moves = ['flamethrower', 'dragon-claw', 'earthquake'];
    for (let i = 0; i < moves.length; i++) {
        await page.locator(`.team-slot select[data-slot="${i}"]`).selectOption(moves[i]);
    }
    expect((await analysisRow(page, 1, 'Roche'))[0]).toBe('×2');
    expect((await analysisRow(page, 1, 'Électrik'))[0]).toBe('×2');

    await page.reload();
    await page.waitForFunction(() => !gameSelect.disabled && allPokemon.length > 0);
    expect(await page.evaluate(() => userTeam[0].moves.filter(Boolean))).toEqual(moves);
});

test('suggestions pour compléter l\'équipe', async ({ page }) => {
    await selectGame(page, 'x');
    await addToTeam(page, 'charizard', 'pikachu', 'gengar');
    await page.click('#tab-mon-equipe');
    const cards = page.locator('.completion-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
    await page.locator('.completion-add').first().click();
    expect(await page.evaluate(() => userTeam.length)).toBe(4);
});

test('générateur : l\'équipe équilibrée a moins de points faibles que la moyenne au hasard', async ({ page }) => {
    await selectGame(page, 'x');
    await page.click('#tab-generateur');
    const threatsOf = () => page.evaluate(() => computeTeamAnalysis(currentGeneratedTeam.map(memberFromPoke)).threats.length);
    const average = async (balanced) => {
        await page.locator('#balanced-team').setChecked(balanced);
        let total = 0;
        for (let i = 0; i < 6; i++) {
            await page.click('#generate-btn');
            expect(await page.evaluate(() => new Set(currentGeneratedTeam.map(p => p.speciesName)).size)).toBe(6);
            total += await threatsOf();
        }
        return total / 6;
    };
    const balanced = await average(true);
    const random = await average(false);
    expect(balanced).toBeLessThan(random);
});

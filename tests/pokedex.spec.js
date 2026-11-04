// Pokédex : recherche, Pokédex vivant, chromatiques, calculatrice, clavier.
const { test, expect } = require('./fixtures');

test('recherche insensible aux accents', async ({ page }) => {
    await page.fill('#search', 'evoli');
    await expect(page.locator('#pokedex-list h3')).toHaveText(['Évoli']);
});

test('Pokédex vivant : statuts, progression, filtre, sauvegarde', async ({ page }) => {
    const first = page.locator('#pokedex-list .dex-status').first();
    await first.click();               // vu
    await page.locator('#pokedex-list .dex-status').first().click(); // capturé
    await expect(page.locator('#dex-progress-text')).toContainText('1 / 151 capturés');
    await expect(page.locator('#pokedex-list .dex-status').first()).toBeFocused();

    await page.selectOption('#dex-status-filter', 'caught');
    await expect(page.locator('#pokedex-list h3')).toHaveText(['Bulbizarre']);

    await page.reload();
    await page.waitForFunction(() => !gameSelect.disabled && allPokemon.length > 0);
    await expect(page.locator('#dex-progress-text')).toContainText('1 / 151 capturés');
});

test('images chromatiques', async ({ page }) => {
    await page.click('#shiny-toggle-btn');
    await expect(page.locator('#pokedex-list img').first()).toHaveAttribute('src', /official-artwork\/shiny\/1\.png$/);
    await expect(page.locator('#shiny-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
});

test('calculatrice : Pokémon défenseur, résumé et table complète', async ({ page }) => {
    await page.click('#tab-calculatrice');
    await page.fill('#calc-pokemon-input', 'Dracaufeu');
    await expect(page.locator('#def-type1-select')).toHaveValue('fire');
    await expect(page.locator('#def-type2-select')).toHaveValue('flying');
    await expect(page.locator('#calc-defender-summary')).toContainText('Très efficace (×4)Roche');

    await page.click('.type-chart-details summary');
    expect(await page.locator('.type-chart-table tbody tr').count()).toBe(15); // 15 types en gén. 1
});

test('navigation au clavier : onglets et cartes', async ({ page }) => {
    await page.focus('#tab-pokedex');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-mon-equipe')).toBeFocused();
    await expect(page.locator('#tab-mon-equipe')).toHaveAttribute('aria-selected', 'true');

    await page.click('#tab-pokedex');
    await page.locator('#pokedex-list .card-main').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tab-stats')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#stats-poke1-input')).toHaveValue('Bulbizarre');
});

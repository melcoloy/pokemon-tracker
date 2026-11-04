// Hors ligne : service worker, Chart.js local, téléchargement de tous les jeux.
const { test, expect, waitForGame, selectGame } = require('./fixtures');

test.use({ serviceWorkers: 'allow' });

test('l\'app fonctionne sans connexion après « Tout télécharger »', async ({ page, context }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await waitForGame(page);
    expect(await page.evaluate(() => typeof Chart)).toBe('function');

    await page.click('#offline-btn');
    await expect(page.locator('#offline-status')).toContainText('✅', { timeout: 60000 });

    await context.setOffline(true);
    await page.reload();
    await waitForGame(page);
    await selectGame(page, 'scarlet'); // jamais ouvert : vient du téléchargement
    await page.evaluate(() => selectPokemonInStats(nameToPoke.pikachu.id));
    await expect(page.locator('.moves-table').first()).toBeVisible();
});

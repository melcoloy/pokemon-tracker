// Outils communs aux tests : page prête, réseau extérieur coupé, sélection d'un jeu.
const base = require('@playwright/test');

const test = base.test.extend({
    // Chaque test : PokéAPI et images coupées (l'app doit marcher avec les seuls fichiers locaux),
    // stockage vidé, animations désactivées. `apiCalls` liste les appels à PokéAPI tentés.
    apiCalls: async ({}, use) => { await use([]); },

    page: async ({ page, apiCalls }, use) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route(/pokeapi\.co|raw\.githubusercontent\.com/, route => {
            if (route.request().url().includes('pokeapi.co')) apiCalls.push(route.request().url());
            route.abort();
        });
        await page.addInitScript(() => {
            if (!sessionStorage.getItem('__test_storage_cleared')) {
                localStorage.clear();
                sessionStorage.setItem('__test_storage_cleared', '1');
            }
        });
        await page.goto('/');
        await waitForGame(page);
        await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
        await use(page);
        base.expect(errors, 'erreurs JavaScript sur la page').toEqual([]);
    }
});

async function waitForGame(page) {
    await page.waitForFunction(() => typeof gameSelect !== 'undefined' && !gameSelect.disabled
        && allPokemon.length > 0 && Object.keys(currentTypeChart).length > 0);
}

// Change de jeu et attend qu'il soit chargé (génération du jeu active)
async function selectGame(page, slug) {
    await page.selectOption('#game-select', slug);
    await page.waitForFunction(s => gameSelect.value === s && !gameSelect.disabled
        && currentGeneration === GAME_GENERATION[s] && allPokemon.length > 0, slug);
}

async function addToTeam(page, ...speciesNames) {
    await page.evaluate(names => names.forEach(n => addToTeam(nameToPoke[n])), speciesNames);
}

// Valeurs d'une ligne d'un tableau d'analyse (case vide = '·')
async function analysisRow(page, tableIndex, rowLabel) {
    return page.evaluate(([i, label]) => {
        const table = document.querySelectorAll('.analysis-table')[i];
        const row = [...table.querySelectorAll('tbody tr')].find(r => r.querySelector('th').textContent.trim() === label);
        return row ? [...row.querySelectorAll('td')].map(td => td.textContent.trim() || '·') : null;
    }, [tableIndex, rowLabel]);
}

module.exports = { test, expect: base.expect, waitForGame, selectGame, addToTeam, analysisRow };

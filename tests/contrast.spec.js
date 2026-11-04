// Accessibilité : contraste des textes (WCAG AA) dans tous les onglets, en mode clair et sombre.
const { test, expect, selectGame, addToTeam } = require('./fixtures');

// Renvoie les textes visibles dont le contraste avec leur fond est insuffisant
function auditContrast(page) {
    return page.evaluate(() => {
        const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
        const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const background = el => {
            for (let e = el; e; e = e.parentElement) {
                const cs = getComputedStyle(e);
                if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // dégradé : non mesurable
                const c = parse(cs.backgroundColor);
                if (c && c.a > 0.5) return c;
            }
            return { r: 255, g: 255, b: 255, a: 1 };
        };
        const problems = new Set();
        document.querySelectorAll('body *').forEach(el => {
            if (!el.offsetParent) return;
            const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
            if (!text || el.closest('[aria-hidden="true"], header')) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden') return;
            const fg = parse(cs.color);
            const bg = background(el);
            if (!fg || !bg) return;
            const [l1, l2] = [lum(fg), lum(bg)];
            const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            const size = parseFloat(cs.fontSize);
            const min = (size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)) ? 3 : 4.5;
            if (ratio < min) problems.add(`${ratio.toFixed(2)} < ${min} : ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} « ${text.slice(0, 40)} »`);
        });
        return [...problems];
    });
}

for (const colorScheme of ['light', 'dark']) {
    test.describe(`mode ${colorScheme === 'dark' ? 'sombre' : 'clair'}`, () => {
        test.use({ colorScheme });

        test('contraste suffisant dans tous les onglets', async ({ page }) => {
            await selectGame(page, 'x');
            await addToTeam(page, 'pikachu', 'eevee', 'gengar');
            const problems = [];
            const visit = async (tab, prepare) => {
                await page.click(`#tab-${tab}`);
                if (prepare) await prepare();
                problems.push(...(await auditContrast(page)).map(p => `[${tab}] ${p}`));
            };

            await visit('pokedex', async () => {
                await page.locator('#pokedex-list .dex-status').first().click();
                await page.locator('#pokedex-list .dex-status').nth(1).click();
                await page.locator('#pokedex-list .dex-status').nth(1).click();
            });
            await visit('mon-equipe', () => page.evaluate(() => document.querySelectorAll('.team-config').forEach(d => { d.open = true; })));
            await visit('calculatrice', async () => {
                await page.fill('#calc-pokemon-input', 'Dracaufeu');
                await page.selectOption('#atk-type-select', 'rock');
                await page.click('#calculate-btn');
                await page.click('.type-chart-details summary');
            });
            await visit('generateur', () => page.click('#generate-btn'));
            await visit('evolutions', () => page.fill('#evolution-search', 'evoli'));
            await visit('specificities');
            await visit('stats', async () => {
                await page.evaluate(() => { statsSelectedPoke1 = nameToPoke.pikachu.id; statsSelectedPoke2 = nameToPoke.eevee.id; updateStatsChart(); });
                await page.check('#show-move-descriptions');
            });

            expect(problems).toEqual([]);
        });
    });
}

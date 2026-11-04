// Initialisation

window.addEventListener('DOMContentLoaded', () => {
    // Reprend le dernier jeu consulté (s'il existe toujours dans la liste)
    const lastGame = readStorageJson('lastGame', null);
    if (lastGame && [...gameSelect.options].some(o => o.value === lastGame)) {
        gameSelect.value = lastGame;
    }

    loadSavedTeams(gameSelect.value);
    updateGameCover(gameSelect.value);
    loadGame(gameSelect.value);
    loadTypeChart();
});

// === Hors ligne : service worker (cache de l'app, des données et des images déjà vues) ===
// Il ne fonctionne qu'en http(s) (serveur local ou GitHub Pages), pas en ouvrant le fichier directement.
// Doit correspondre à DATA_CACHE dans sw.js.
const OFFLINE_DATA_CACHE = 'data-v1';

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').then(() => {
        if ('caches' in window) offlineBtn.hidden = false;
    }).catch(e => console.warn('Service worker non enregistré', e));
}

// Télécharge les données de TOUS les jeux d'un coup (environ 12 Mo), pour pouvoir changer de jeu sans connexion.
// Les images, elles, sont gardées au fur et à mesure qu'elles s'affichent.
offlineBtn.addEventListener('click', async () => {
    const slugs = [...gameSelect.options].map(o => o.value);
    const urls = ['data/types.json', 'data/names.json', 'data/past.json',
        ...slugs.flatMap(slug => [`data/${slug}.json`, `data/extra/${slug}.json`])];
    offlineBtn.disabled = true;
    let done = 0;
    let failed = 0;
    try {
        const cache = await caches.open(OFFLINE_DATA_CACHE);
        await mapWithConcurrencyBrowser(urls, 4, async (url) => {
            try {
                const response = await fetch(url, { cache: 'reload' });
                if (response.ok) await cache.put(url, response);
                else failed++;
            } catch (e) {
                failed++;
            }
            done++;
            offlineStatus.textContent = `Téléchargement… ${done} / ${urls.length}`;
        });
        offlineStatus.textContent = failed
            ? `${urls.length - failed} fichiers enregistrés, ${failed} en échec : réessaie avec une connexion.`
            : '✅ Tous les jeux sont disponibles hors ligne (les images se gardent quand elles s\'affichent).';
    } catch (e) {
        offlineStatus.textContent = 'Impossible d\'enregistrer les données dans ce navigateur.';
    }
    offlineBtn.disabled = false;
});

// Mode sombre

// La classe "dark-mode" est posée sur <html> par un petit script dans <head> (index.html),
// avant l'affichage, pour éviter un flash en mode clair. Ce fichier gère ensuite le bouton.
// Sans choix enregistré, l'app suit le réglage clair / sombre du système.
const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark-mode', isDark);
    themeToggleBtn.textContent = isDark ? '☀️ Mode clair' : '🌙 Mode sombre';
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
    // Le radar des stats est dessiné sur un canvas : il faut le redessiner avec les bonnes couleurs
    if (statsChartInstance) updateStatsChart();
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = !isDarkMode();
    writeStorage('darkMode', isDark ? '1' : '0');
    applyTheme(isDark);
});

if (systemDarkQuery) {
    systemDarkQuery.addEventListener('change', (e) => {
        if (readStorageJson('darkMode', null) === null) applyTheme(e.matches);
    });
}

(function initTheme() {
    const saved = readStorageJson('darkMode', null);
    applyTheme(saved === null ? Boolean(systemDarkQuery && systemDarkQuery.matches) : String(saved) === '1');
})();

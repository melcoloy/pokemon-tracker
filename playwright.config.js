// Configuration des tests de bout en bout (Playwright).
// Lancer : npm test   (le serveur local est démarré automatiquement)
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8765;

module.exports = defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        // Le service worker est bloqué par défaut pour des tests reproductibles (offline.spec.js l'active)
        serviceWorkers: 'block',
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `python3 -m http.server ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'ignore'
    }
});

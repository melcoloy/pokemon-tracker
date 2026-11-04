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

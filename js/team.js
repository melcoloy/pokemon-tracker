// Onglet Mon Équipe

// === Équipes sauvegardées : une équipe par jeu ===
// localStorage "userTeams" = { slug du jeu -> [membres] }.
// L'ancienne clé "userTeam" (une seule équipe pour tous les jeux) est reprise une fois,
// pour le premier jeu ouvert, puis supprimée.
const TEAM_SIZE_MAX = 6;

function sanitizeTeam(team) {
    return Array.isArray(team) ? team.filter(p => p && typeof p.id === 'number').slice(0, TEAM_SIZE_MAX) : [];
}

function loadSavedTeams(initialGameSlug) {
    const saved = readStorageJson('userTeams', null);
    teamsByGame = {};
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        Object.entries(saved).forEach(([slug, team]) => { teamsByGame[slug] = sanitizeTeam(team); });
    }

    const legacy = readStorageJson('userTeam', null);
    if (legacy !== null) {
        if (!teamsByGame[initialGameSlug] || teamsByGame[initialGameSlug].length === 0) {
            teamsByGame[initialGameSlug] = sanitizeTeam(legacy);
        }
        writeStorage('userTeams', teamsByGame);
        try { localStorage.removeItem('userTeam'); } catch (e) { /* stockage bloqué : rien à faire */ }
    }
}

// === Rend active l'équipe du jeu sélectionné ===
let activeTeamSlug = null; // jeu auquel appartient l'équipe affichée

function setActiveTeamForGame(versionSlug) {
    activeTeamSlug = versionSlug;
    if (!teamsByGame[versionSlug]) teamsByGame[versionSlug] = [];
    userTeam = teamsByGame[versionSlug];
    teamGameLabel.textContent = `Équipe pour ${currentGameLabel()}`;
}

// === Gestion de l'équipe ===
// Un membre de l'équipe est identifié par le nom de sa VARIÉTÉ (ex : 'raichu' vs 'raichu-alola'),
// car une forme régionale partage le numéro national de la forme classique.
// Les anciennes entrées sauvegardées sans "pokemonName" retombent sur le numéro.
function teamEntryFromPoke(poke) {
    return {
        id: poke.id,
        pokemonName: poke.name,
        name: poke.frenchName,
        image: getArtworkUrl(poke),
        types: poke.frenchTypes
    };
}

function isSameTeamMon(teamMon, poke) {
    return teamMon.pokemonName ? teamMon.pokemonName === poke.name : teamMon.id === poke.id;
}

// === Retrouve dans le jeu actif le Pokémon correspondant à un membre de l'équipe (ou undefined) ===
function findTeamMonInGame(teamMon) {
    return allPokemon.find(p => isSameTeamMon(teamMon, p));
}

function addToTeam(poke) {
    if (userTeam.length >= TEAM_SIZE_MAX) {
        alert('Équipe complète ! (6 Pokémon max)');
        return;
    }

    if (userTeam.some(t => isSameTeamMon(t, poke))) {
        alert('Ce Pokémon est déjà dans votre équipe');
        return;
    }

    userTeam.push(teamEntryFromPoke(poke));
    saveTeam();
    updateTeamDisplay();
}

function removeFromTeam(index) {
    if (index < 0 || index >= userTeam.length) return;
    userTeam.splice(index, 1);
    saveTeam();
    updateTeamDisplay();
}

function saveTeam() {
    if (!activeTeamSlug) return;
    teamsByGame[activeTeamSlug] = userTeam;
    writeStorage('userTeams', teamsByGame);
}

function updateTeamDisplay() {
    if (userTeam.length === 0) {
        teamDisplay.innerHTML = '<p>Aucun Pokémon ajouté. Clique sur un Pokémon dans le Pokédex pour le consulter, puis ajoute-le depuis l\'onglet Statistiques !</p>';
    } else {
        teamDisplay.innerHTML = userTeam.map((poke, index) => `
            <div class="team-slot filled">
                <img src="${escapeHtml(poke.image || '')}" alt="${escapeHtml(poke.name)}">
                <h4>${escapeHtml(poke.name)}</h4>
                <p>#${poke.id}</p>
                <p class="types">${(poke.types && poke.types.length) ? escapeHtml(poke.types.join(', ')) : 'Type(s) inconnu(s)'}</p>
                <button class="remove-btn" data-index="${index}">Supprimer</button>
            </div>
        `).join('');
    }

    renderEvolutionsTab();
    renderTeamAnalysis();
}

teamDisplay.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-btn[data-index]');
    if (btn) removeFromTeam(Number(btn.dataset.index));
});

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

// === Talent et capacités choisis pour un membre (utilisés par l'analyse de l'équipe) ===
const MAX_CHOSEN_MOVES = 4;

// Talents possibles du Pokémon dans ce jeu (aucun avant la 3e génération)
function getPossibleAbilities(poke) {
    if (currentGeneration < 3 || !Array.isArray(poke.abilities)) return [];
    return poke.abilities;
}

// Talent retenu : celui choisi s'il est encore possible, sinon le premier talent normal
function getEffectiveAbility(teamMon, poke) {
    const abilities = getPossibleAbilities(poke);
    if (abilities.length === 0) return null;
    if (teamMon.ability && abilities.some(a => a.name === teamMon.ability)) return teamMon.ability;
    const firstNormal = abilities.find(a => !a.isHidden) || abilities[0];
    return firstNormal.name;
}

// Capacités apprenables dans ce jeu (toutes méthodes), triées par nom français
function getLearnableMoves(poke) {
    const learnset = gameExtra && gameExtra.learnsets && gameExtra.learnsets[poke.name];
    if (!learnset) return [];
    const moves = new Set([
        ...(learnset.level || []).map(([, move]) => move),
        ...(learnset.machine || []),
        ...(learnset.egg || []),
        ...(learnset.tutor || [])
    ]);
    return [...moves].sort((a, b) => moveNameFr(a).localeCompare(moveNameFr(b)));
}

// Capacités choisies encore apprenables (4 emplacements, '' = vide)
function getChosenMoves(teamMon, poke) {
    const learnable = new Set(getLearnableMoves(poke));
    const chosen = Array.isArray(teamMon.moves) ? teamMon.moves : [];
    return Array.from({ length: MAX_CHOSEN_MOVES }, (_, i) => (learnable.has(chosen[i]) ? chosen[i] : ''));
}

function teamConfigSummaryText(teamMon, poke) {
    const count = getChosenMoves(teamMon, poke).filter(Boolean).length;
    const ability = getEffectiveAbility(teamMon, poke);
    const abilityText = ability ? (frNames.abilities[ability] || formatLocationName(ability)) : null;
    return `${abilityText ? `${abilityText} · ` : ''}${count}/${MAX_CHOSEN_MOVES} capacités`;
}

// === Volet "Talent et capacités" d'une carte de l'équipe ===
function teamConfigHtml(teamMon, index) {
    const poke = findTeamMonInGame(teamMon);
    if (!poke) return '<p class="team-config-missing">Pas dans ce jeu</p>';

    const abilities = getPossibleAbilities(poke);
    const effectiveAbility = getEffectiveAbility(teamMon, poke);
    const abilityField = abilities.length === 0 ? '' : `
        <label class="team-config-field">
            <span>Talent</span>
            <select data-index="${index}" data-field="ability">
                ${abilities.map(a => `<option value="${escapeHtml(a.name)}" ${a.name === effectiveAbility ? 'selected' : ''}>${escapeHtml(frNames.abilities[a.name] || formatLocationName(a.name))}${a.isHidden ? ' (caché)' : ''}</option>`).join('')}
            </select>
        </label>`;

    const learnable = getLearnableMoves(poke);
    const chosen = getChosenMoves(teamMon, poke);
    const moveOptions = learnable.map(move => {
        const type = gameExtra.moves && gameExtra.moves[move] ? gameExtra.moves[move][0] : null;
        return { move, label: `${moveNameFr(move)}${type ? ` (${typeNameFr(type)})` : ''}` };
    });
    const moveFields = learnable.length === 0
        ? '<p class="team-config-missing">Capacités indisponibles pour ce jeu</p>'
        : chosen.map((current, slot) => `
            <label class="team-config-field">
                <span>Capacité ${slot + 1}</span>
                <select data-index="${index}" data-field="move" data-slot="${slot}">
                    <option value="">—</option>
                    ${moveOptions.map(o => `<option value="${escapeHtml(o.move)}" ${o.move === current ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                </select>
            </label>`).join('');

    return `
        <details class="team-config">
            <summary>Talent et capacités<br><span class="team-config-summary" data-summary-index="${index}">${escapeHtml(teamConfigSummaryText(teamMon, poke))}</span></summary>
            ${abilityField}
            ${moveFields}
        </details>`;
}

function updateTeamDisplay() {
    if (userTeam.length === 0) {
        teamDisplay.innerHTML = '<p>Aucun Pokémon ajouté. Clique sur un Pokémon dans le Pokédex pour le consulter, puis ajoute-le depuis l\'onglet Statistiques !</p>';
    } else {
        teamDisplay.innerHTML = userTeam.map((poke, index) => `
            <div class="team-slot filled">
                <img src="${escapeHtml(teamImageUrl(poke))}" alt="${escapeHtml(poke.name)}">
                <h4>${escapeHtml(poke.name)}</h4>
                <p>#${poke.id}</p>
                <p class="types">${(poke.types && poke.types.length) ? escapeHtml(poke.types.join(', ')) : 'Type(s) inconnu(s)'}</p>
                ${teamConfigHtml(poke, index)}
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

// === Choix du talent ou d'une capacité : enregistre et met à jour l'analyse ===
// (sans redessiner les cartes, pour ne pas faire perdre le focus au clavier)
teamDisplay.addEventListener('change', (e) => {
    const select = e.target.closest('select[data-index][data-field]');
    if (!select) return;
    const teamMon = userTeam[Number(select.dataset.index)];
    if (!teamMon) return;

    if (select.dataset.field === 'ability') {
        teamMon.ability = select.value;
    } else {
        const moves = Array.isArray(teamMon.moves) ? [...teamMon.moves] : [];
        while (moves.length < MAX_CHOSEN_MOVES) moves.push('');
        moves[Number(select.dataset.slot)] = select.value;
        teamMon.moves = moves;
    }
    saveTeam();

    const poke = findTeamMonInGame(teamMon);
    const summary = teamDisplay.querySelector(`[data-summary-index="${select.dataset.index}"]`);
    if (poke && summary) summary.textContent = teamConfigSummaryText(teamMon, poke);
    renderTeamAnalysis();
});

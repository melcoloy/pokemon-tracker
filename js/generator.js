// Onglet Générateur

// === Générateur d'équipe ===
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generateTeam() {
    if (allPokemon.length === 0) {
        alert('Les données ne sont pas encore chargées, réessaie dans un instant.');
        return;
    }

    const avoidDuplicates = avoidDuplicateTypes.checked;
    const onlyFinal = finalStageOnly.checked;
    const noLegendary = excludeLegendary.checked;

    let pool = allPokemon;
    if (onlyFinal) pool = pool.filter(p => p.isFinal);
    if (noLegendary) pool = pool.filter(p => !p.isLegendary);

    if (pool.length === 0) {
        alert('Aucun Pokémon ne correspond aux filtres sélectionnés.');
        return;
    }

    const shuffled = shuffleArray(pool);

    if (balancedTeam.checked && Object.keys(currentTypeChart).length) {
        currentGeneratedTeam = generateBalancedTeam(shuffled, avoidDuplicates);
        displayGeneratedTeam(currentGeneratedTeam);
        return;
    }

    const team = [];
    const usedTypes = new Set();

    for (const poke of shuffled) {
        if (team.length >= 6) break;

        const pokeTypes = poke.types.map(t => t.type.name);

        if (avoidDuplicates) {
            const hasOverlap = pokeTypes.some(t => usedTypes.has(t));
            if (hasOverlap) continue;
        }

        team.push(poke);
        pokeTypes.forEach(t => usedTypes.add(t));
    }

    if (team.length < 6) {
        for (const poke of shuffled) {
            if (team.length >= 6) break;
            if (!team.some(p => p.id === poke.id)) {
                team.push(poke);
            }
        }
    }

    currentGeneratedTeam = team;
    displayGeneratedTeam(team);
}

// === Équipe équilibrée : chaque nouveau membre est choisi parmi les meilleurs candidats ===
// (ceux qui résistent aux faiblesses de l'équipe en cours et couvrent ses types non couverts),
// avec une part de hasard pour varier les équipes.
function generateBalancedTeam(shuffledPool, avoidDuplicates) {
    const team = [shuffledPool[0]];
    const typesOf = p => p.types.map(t => t.type.name);

    while (team.length < TEAM_SIZE_MAX) {
        const usedSpecies = new Set(team.map(p => p.speciesName));
        const usedTypes = new Set(team.flatMap(typesOf));
        let candidates = shuffledPool.filter(p => !usedSpecies.has(p.speciesName));
        if (candidates.length === 0) break;
        if (avoidDuplicates) {
            const withoutDuplicates = candidates.filter(p => !typesOf(p).some(t => usedTypes.has(t)));
            if (withoutDuplicates.length) candidates = withoutDuplicates;
        }

        const analysis = computeTeamAnalysis(team.map(memberFromPoke));
        const ranked = candidates
            .slice(0, 200) // échantillon aléatoire : suffisant et rapide
            .map(p => scoreCandidateForTeam(p, analysis))
            .sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, 5);
        team.push(top[Math.floor(Math.random() * top.length)].poke);
    }
    return team;
}

function displayGeneratedTeam(team) {
    generatedTeamDisplay.innerHTML = team.map(poke => `
        <div class="pokemon-card">
            <img src="${escapeHtml(getArtworkUrl(poke))}" alt="${escapeHtml(poke.frenchName)}">
            <h3>${escapeHtml(poke.frenchName)}</h3>
            <p>#${poke.id.toString().padStart(3, '0')}</p>
            <p class="types">${escapeHtml(poke.frenchTypes.join(', '))}</p>
        </div>
    `).join('');

    addAllBtn.style.display = team.length > 0 ? 'block' : 'none';
}

function addGeneratedTeamToMyTeam() {
    if (currentGeneratedTeam.length === 0) return;

    userTeam = currentGeneratedTeam.map(teamEntryFromPoke);

    saveTeam();
    updateTeamDisplay();
    alert('Équipe ajoutée à "Mon Équipe" !');
}

generateBtn.addEventListener('click', generateTeam);
addAllBtn.addEventListener('click', addGeneratedTeamToMyTeam);

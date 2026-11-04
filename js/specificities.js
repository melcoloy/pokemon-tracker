// Onglet Spécificités

// === Spécificités : versions du jeu où chaque Pokémon est rencontrable (depuis data/extra/{jeu}.json) ===
// Renvoie null si le jeu n'a pas de données de rencontre.
function getEncounterVersionsByPokemon() {
    if (!gameExtra || !Array.isArray(gameExtra.locations) || gameExtra.locations.length === 0) return null;
    const byPokemon = {};
    gameExtra.locations.forEach(loc => {
        Object.entries(loc.versions).forEach(([version, names]) => {
            names.forEach(name => {
                (byPokemon[name] = byPokemon[name] || new Set()).add(version);
            });
        });
    });
    return byPokemon;
}

// === Nom français d'une version (ex : "red" -> "Rouge") ===
function versionNameFr(version) {
    return frNames.versions[version] || formatLocationName(version);
}

// === Spécificités : charge et affiche méga-évolutions, formes spéciales et exclusivités pour le jeu actif ===
function loadSpecificities() {
    const slug = gameSelect.value;

    if (specificitiesCache[slug]) {
        renderSpecificities(specificitiesCache[slug]);
        return;
    }

    if (allPokemon.length === 0) {
        megaListDisplay.innerHTML = '<p>Le Pokédex n\'est pas encore chargé, réessaie dans un instant.</p>';
        return;
    }

    // 1. Méga-évolutions
    const hasMega = GAMES_WITH_MEGA.has(slug);
    const megas = hasMega
        ? allPokemon.filter(p => p.varieties && p.varieties.some(v => /-mega(-x|-y)?$/.test(v)))
        : [];

    // 2. Formes spéciales (liste connue)
    const specialForms = SPECIAL_FORMS_DB
        .filter(entry => entry.games.includes(slug))
        .map(entry => ({ poke: nameToPoke[entry.speciesName], label: entry.formLabel }))
        .filter(entry => entry.poke);

    // 3. Exclusivités de version (seulement si le jeu a exactement 2 versions jumelles)
    let exclusives = null;
    if (currentGameVersions.length === 2) {
        const [versionA, versionB] = currentGameVersions;
        const encounters = getEncounterVersionsByPokemon();
        const sideOf = poke => {
            const versions = encounters && encounters[poke.name];
            if (!versions) return null;
            if (versions.has(versionA) && !versions.has(versionB)) return 'A';
            if (versions.has(versionB) && !versions.has(versionA)) return 'B';
            return null;
        };
        exclusives = {
            versionA,
            versionB,
            noData: !encounters,
            listA: allPokemon.filter(p => sideOf(p) === 'A'),
            listB: allPokemon.filter(p => sideOf(p) === 'B')
        };
    }

    specificitiesCache[slug] = { megas, specialForms, exclusives };
    renderSpecificities(specificitiesCache[slug]);
}

// === Spécificités : construit une carte simple (image + nom) ===
function specificityCardHtml(poke, subLabel) {
    return `
        <div class="pokemon-card">
            <img src="${escapeHtml(getArtworkUrl(poke))}" alt="${escapeHtml(poke.frenchName)}">
            <h3>${escapeHtml(poke.frenchName)}</h3>
            ${subLabel ? `<p class="types">${subLabel}</p>` : ''}
        </div>
    `;
}

// === Spécificités : affiche les 3 sections ===
function renderSpecificities(data) {
    const { megas, specialForms, exclusives } = data;

    megaListDisplay.innerHTML = megas.length
        ? megas.map(p => specificityCardHtml(p)).join('')
        : '<p class="evolutions-empty">Pas de méga-évolution dans ce jeu.</p>';

    specialFormsListDisplay.innerHTML = specialForms.length
        ? specialForms.map(entry => specificityCardHtml(entry.poke, entry.label)).join('')
        : '<p class="evolutions-empty">Aucune forme spéciale connue pour ce jeu (dans notre petite liste).</p>';

    if (!exclusives) {
        versionExclusivesDisplay.innerHTML = '<p class="evolutions-empty">Ce jeu n\'a pas de version jumelle : pas d\'exclusivités applicables.</p>';
        return;
    }

    if (exclusives.noData) {
        versionExclusivesDisplay.innerHTML = '<p class="evolutions-empty">PokéAPI ne fournit pas de données de rencontres sauvages pour ce jeu : exclusivités indisponibles.</p>';
        return;
    }

    const labelA = versionNameFr(exclusives.versionA);
    const labelB = versionNameFr(exclusives.versionB);

    const listAHtml = exclusives.listA.length
        ? exclusives.listA.map(p => `<li>${escapeHtml(p.frenchName)}</li>`).join('')
        : '<li class="moves-empty">Aucun trouvé</li>';
    const listBHtml = exclusives.listB.length
        ? exclusives.listB.map(p => `<li>${escapeHtml(p.frenchName)}</li>`).join('')
        : '<li class="moves-empty">Aucun trouvé</li>';

    versionExclusivesDisplay.innerHTML = `
        <div class="moves-column">
            <h4>Exclusifs ${escapeHtml(labelA)}</h4>
            <ul class="moves-list">${listAHtml}</ul>
        </div>
        <div class="moves-column">
            <h4>Exclusifs ${escapeHtml(labelB)}</h4>
            <ul class="moves-list">${listBHtml}</ul>
        </div>
    `;
}

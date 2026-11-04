// Onglet Évolutions

// === Tracker d'évolutions ===

// === Noms français utilisés dans les conditions (data/names.json, sinon identifiant lisible) ===
function itemNameFr(slug) {
    return frNames.items[slug] || formatLocationName(slug);
}

function moveNameFr(slug) {
    return frNames.moves[slug] || formatLocationName(slug);
}

function speciesNameFr(slug) {
    return frNames.species[slug] || (nameToPoke[slug] && nameToPoke[slug].frenchName) || formatLocationName(slug);
}

function locationNameFr(slug) {
    return frNames.locations[slug] || formatLocationName(slug);
}

const TIME_OF_DAY_FR = { day: 'le jour', night: 'la nuit', dusk: 'au crépuscule', 'full-moon': 'à la pleine lune' };
const RELATIVE_STATS_FR = { '1': 'Attaque > Défense', '-1': 'Attaque < Défense', '0': 'Attaque = Défense' };

// === Décrit en français UNE condition d'évolution (format compact de data/extra/{jeu}.json) ===
function describeEvolutionDetail(d) {
    const parts = [];

    switch (d.trigger) {
        case 'level-up':
            parts.push(d.level ? `Niveau ${d.level}` : 'Montée de niveau');
            break;
        case 'trade':
            parts.push(d.tradeSpecies ? `Échange contre ${speciesNameFr(d.tradeSpecies)}` : 'Échange');
            break;
        case 'use-item':
            parts.push(`Utiliser : ${itemNameFr(d.item)}`);
            break;
        case 'shed':
            parts.push('Apparaît quand Ningale évolue (place libre dans l\'équipe + une Poké Ball dans le sac)');
            break;
        case 'spin':
            parts.push('Tourner sur soi-même en tenant une Sucrerie');
            break;
        case 'tower-of-darkness':
            parts.push('Gravir la Tour des Ténèbres');
            break;
        case 'tower-of-waters':
            parts.push('Gravir la Tour de l\'Eau');
            break;
        case 'three-critical-hits':
            parts.push('Réussir 3 coups critiques dans un même combat');
            break;
        case 'take-damage':
            parts.push(`Perdre au moins ${d.damageTaken || 49} PV puis passer sous l'arche de pierre des Dunes de la Poussière`);
            break;
        case 'agile-style-move':
            parts.push(`Utiliser ${moveNameFr(d.usedMove)} ${d.moveCount || 20} fois en Style Rapide`);
            break;
        case 'strong-style-move':
            parts.push(`Utiliser ${moveNameFr(d.usedMove)} ${d.moveCount || 20} fois en Style Puissant`);
            break;
        case 'recoil-damage':
            parts.push(`Subir au moins ${d.damageTaken || 294} PV de dégâts de contrecoup`);
            break;
        case 'use-move':
            parts.push(`Utiliser ${moveNameFr(d.usedMove)}${d.moveCount ? ` ${d.moveCount} fois` : ''}`);
            break;
        case 'three-defeated-bisharp':
            parts.push('Vaincre 3 Scalproie qui mènent des Scalpion');
            break;
        case 'gimmighoul-coins':
            parts.push('Réunir 999 Pièces de Mordudor');
            break;
        default:
            parts.push('Condition spéciale');
    }

    if (d.item && d.trigger !== 'use-item') parts.push(`avec : ${itemNameFr(d.item)}`);
    if (d.heldItem) parts.push(`en tenant : ${itemNameFr(d.heldItem)}`);
    if (d.gender) parts.push(d.gender === 'female' ? 'femelle uniquement' : 'mâle uniquement');
    if (d.happiness) parts.push('Bonheur élevé');
    if (d.affection) parts.push('Affection élevée');
    if (d.beauty) parts.push('Beauté élevée');
    if (d.time) parts.push(TIME_OF_DAY_FR[d.time] || d.time);
    if (d.knownMove) parts.push(`connaître ${moveNameFr(d.knownMove)}`);
    if (d.knownMoveType) parts.push(`connaître une capacité de type ${typeNameFr(d.knownMoveType)}`);
    if (d.location) parts.push(`à : ${locationNameFr(d.location)}`);
    if (d.relativeStats !== undefined && RELATIVE_STATS_FR[String(d.relativeStats)]) parts.push(RELATIVE_STATS_FR[String(d.relativeStats)]);
    if (d.partySpecies) parts.push(`avec ${speciesNameFr(d.partySpecies)} dans l'équipe`);
    if (d.partyType) parts.push(`avec un Pokémon de type ${typeNameFr(d.partyType)} dans l'équipe`);
    if (d.rain) parts.push('sous la pluie');
    if (d.upsideDown) parts.push('console tenue à l\'envers');
    if (d.multiplayer) parts.push('en jeu en ligne / multijoueur');
    if (d.steps) parts.push(`après ${d.steps} pas avec le Pokémon`);
    if (d.moveCount && !['use-move', 'agile-style-move', 'strong-style-move'].includes(d.trigger)) {
        parts.push(`après avoir utilisé ${moveNameFr(d.usedMove)} ${d.moveCount} fois`);
    }

    return parts.join(' + ');
}

// === Condition(s) d'évolution vers une espèce pour le jeu actif ("A ou B" s'il y a plusieurs méthodes) ===
function describeEvolutionForGame(toSpeciesName, fallbackText) {
    const details = gameExtra && gameExtra.evolutions && gameExtra.evolutions[toSpeciesName];
    if (!details || details.length === 0) return fallbackText || 'Condition inconnue';
    return [...new Set(details.map(describeEvolutionDetail))].join(' — ou — ');
}

// === Convertit une condition au format de l'API REST vers le format compact (chargement live) ===
function describeEvolutionMethod(details) {
    if (!details || !details.trigger) return 'Condition inconnue';
    const name = v => (v && v.name) || undefined;
    return describeEvolutionDetail({
        trigger: details.trigger.name,
        item: name(details.item),
        level: details.min_level || undefined,
        gender: details.gender === 1 ? 'female' : details.gender === 2 ? 'male' : undefined,
        location: name(details.location),
        heldItem: name(details.held_item),
        time: details.time_of_day || undefined,
        knownMove: name(details.known_move),
        knownMoveType: name(details.known_move_type),
        happiness: details.min_happiness || undefined,
        beauty: details.min_beauty || undefined,
        affection: details.min_affection || undefined,
        relativeStats: details.relative_physical_stats === null ? undefined : details.relative_physical_stats,
        partySpecies: name(details.party_species),
        partyType: name(details.party_type),
        tradeSpecies: name(details.trade_species),
        rain: details.needs_overworld_rain || undefined,
        upsideDown: details.turn_upside_down || undefined
    });
}

// === Génère le HTML d'une liste de "cartes d'évolution" à partir d'une liste d'arêtes ===
function renderEvolutionRows(edges, container, emptyMessage, showButton) {
    if (edges.length === 0) {
        container.innerHTML = `<p class="evolutions-empty">${emptyMessage}</p>`;
        return;
    }

    container.innerHTML = edges.map(edge => {
        const fromPoke = nameToPoke[edge.fromName];
        const toPoke = nameToPoke[edge.toName];
        if (!fromPoke || !toPoke) return '';

        const buttonHtml = showButton
            ? `<button class="evolution-confirm-btn" data-team-index="${edge.teamIndex}" data-to-species="${escapeHtml(edge.toName)}">✅ Marquer comme évolué</button>`
            : '';

        return `
            <div class="evolution-card">
                <div class="evolution-mon">
                    <img src="${escapeHtml(getArtworkUrl(fromPoke))}" alt="${escapeHtml(fromPoke.frenchName)}">
                    <span>${escapeHtml(fromPoke.frenchName)}</span>
                </div>
                <div class="evolution-arrow">➜</div>
                <div class="evolution-mon">
                    <img src="${escapeHtml(getArtworkUrl(toPoke))}" alt="${escapeHtml(toPoke.frenchName)}">
                    <span>${escapeHtml(toPoke.frenchName)}</span>
                </div>
                <div class="evolution-info">
                    <p class="evolution-method">Condition : ${escapeHtml(describeEvolutionForGame(edge.toName, edge.method))}</p>
                    ${buttonHtml}
                </div>
            </div>
        `;
    }).join('');
}

// === Affiche l'onglet Évolutions en fonction de "Mon Équipe" (parmi les Pokémon du jeu actif) ===
function renderEvolutionsTab() {
    if (allPokemon.length === 0) {
        evolutionsListDisplay.innerHTML = '<p>Chargement...</p>';
        return;
    }

    // Garde l'index dans userTeam pour pouvoir remplacer le bon membre lors d'une évolution
    const teamInThisGame = userTeam
        .map((teamMon, teamIndex) => ({ teamIndex, poke: findTeamMonInGame(teamMon) }))
        .filter(entry => entry.poke);

    if (teamInThisGame.length === 0) {
        evolutionsListDisplay.innerHTML = '<p class="evolutions-empty">Ajoute des Pokémon présents dans ce jeu à "Mon Équipe" pour voir leurs évolutions possibles.</p>';
        return;
    }

    const edges = [];

    teamInThisGame.forEach(({ teamIndex, poke }) => {
        const evolutions = evolutionMap[poke.speciesName] || [];
        evolutions.forEach(evo => {
            edges.push({ teamIndex, fromName: poke.speciesName, toName: evo.toName, method: evo.method });
        });
    });

    renderEvolutionRows(edges, evolutionsListDisplay, 'Tous les Pokémon de ton équipe (présents dans ce jeu) sont déjà à leur forme finale ! 🎉', true);
}

// === Marque un Pokémon de l'équipe comme évolué (remplace son entrée) ===
function markEvolved(teamIndex, toSpeciesName) {
    const toPoke = nameToPoke[toSpeciesName];
    if (!toPoke || !userTeam[teamIndex]) return;

    // Garde les capacités choisies (celles que l'évolution ne peut pas apprendre seront ignorées) ;
    // le talent est réinitialisé car il change souvent à l'évolution
    const previousMoves = userTeam[teamIndex].moves;
    userTeam[teamIndex] = teamEntryFromPoke(toPoke);
    if (Array.isArray(previousMoves)) userTeam[teamIndex].moves = previousMoves;
    saveTeam();
    updateTeamDisplay();
}

evolutionsListDisplay.addEventListener('click', (e) => {
    const btn = e.target.closest('.evolution-confirm-btn[data-team-index]');
    if (btn) markEvolved(Number(btn.dataset.teamIndex), btn.dataset.toSpecies);
});

// === Recherche : trouve le nom d'espèce racine (base) de la chaîne contenant une espèce donnée ===
function findRootSpecies(speciesName) {
    let current = speciesName;
    while (parentMap[current]) {
        current = parentMap[current];
    }
    return current;
}

// === Recherche : reconstruit toutes les arêtes de la chaîne complète depuis la racine, via evolutionMap ===
function getChainEdgesFromMap(rootName) {
    const edges = [];

    function walk(name) {
        const children = evolutionMap[name] || [];
        children.forEach(c => {
            edges.push({ fromName: name, toName: c.toName, method: c.method });
            walk(c.toName);
        });
    }

    walk(rootName);
    return edges;
}

// === Recherche : affiche la chaîne d'évolution du Pokémon recherché (parmi ceux du jeu actif) ===
function performEvolutionSearch() {
    const query = normalizeSearch(evolutionSearchInput.value);

    if (!query) {
        evolutionSearchResult.innerHTML = '';
        return;
    }

    if (allPokemon.length === 0) {
        evolutionSearchResult.innerHTML = '<p class="evolutions-empty">Chargement...</p>';
        return;
    }

    const match = allPokemon.find(p =>
        normalizeSearch(p.frenchName).includes(query) || p.id.toString() === query
    );

    if (!match) {
        evolutionSearchResult.innerHTML = '<p class="evolutions-empty">Aucun Pokémon trouvé dans ce jeu.</p>';
        return;
    }

    const rootName = findRootSpecies(match.speciesName);
    const edges = getChainEdgesFromMap(rootName);
    renderEvolutionRows(edges, evolutionSearchResult, `${escapeHtml(match.frenchName)} n'évolue pas.`, false);
}

evolutionSearchInput.addEventListener('input', performEvolutionSearch);

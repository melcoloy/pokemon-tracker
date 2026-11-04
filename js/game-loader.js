// Chargement d'un jeu (fichiers locaux ou PokéAPI) et exports

// === Récupérer les données d'une espèce (nom FR + chaîne d'évolution + légendaire + variétés) ===
async function getSpeciesData(speciesUrl) {
    const res = await fetch(speciesUrl);
    return res.json();
}

// === Extraire le nom français depuis les données de l'espèce ===
function getFrenchNameFromSpecies(speciesData) {
    const frEntry = speciesData.names.find(n => n.language.name === 'fr');
    return frEntry ? frEntry.name : speciesData.name;
}

// === Récupérer la traduction française d'un type (avec cache) ===
async function getFrenchType(typeUrl, typeName) {
    if (typeTranslations[typeName]) return typeTranslations[typeName];

    const res = await fetch(typeUrl);
    const data = await res.json();
    const frEntry = data.names.find(n => n.language.name === 'fr');
    const frName = frEntry ? frEntry.name : typeName;
    typeTranslations[typeName] = frName;
    return frName;
}

// === Déterminer si un Pokémon est en stade final d'évolution (chargement live uniquement) ===
async function isFinalStage(speciesData) {
    const chainUrl = speciesData.evolution_chain.url;

    let chainData = evolutionChainCache[chainUrl];
    if (!chainData) {
        const res = await fetch(chainUrl);
        chainData = await res.json();
        evolutionChainCache[chainUrl] = chainData;
    }

    function findNode(node) {
        if (node.species.name === speciesData.name) return node;
        for (const child of node.evolves_to) {
            const found = findNode(child);
            if (found) return found;
        }
        return null;
    }

    const node = findNode(chainData.chain);
    if (!node) return true;
    return node.evolves_to.length === 0;
}

// === Remplir le menu déroulant des types (Pokédex) ===
function populateTypeFilter() {
    typeFilter.innerHTML = '<option value="">Tous les types</option>';

    const typesMap = new Map();
    allPokemon.forEach(poke => {
        poke.types.forEach((t, i) => {
            typesMap.set(t.type.name, poke.frenchTypes[i]);
        });
    });

    const sortedTypes = [...typesMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

    sortedTypes.forEach(([englishName, frenchName]) => {
        const option = document.createElement('option');
        option.value = englishName;
        option.textContent = frenchName;
        typeFilter.appendChild(option);
    });
}

// === Récupère les espèces d'un jeu, avec leur ordre régional, le version_group et la région ===
async function getGameSpeciesInfo(versionSlug) {
    const versionRes = await fetch(`https://pokeapi.co/api/v2/version/${versionSlug}`);
    const versionData = await versionRes.json();

    const vgRes = await fetch(versionData.version_group.url);
    const vgData = await vgRes.json();

    const speciesSet = new Set();
    const orderMap = {};

    for (let dexIndex = 0; dexIndex < vgData.pokedexes.length; dexIndex++) {
        const dexRes = await fetch(vgData.pokedexes[dexIndex].url);
        const dexData = await dexRes.json();
        dexData.pokemon_entries.forEach(entry => {
            const name = entry.pokemon_species.name;
            speciesSet.add(name);
            if (!(name in orderMap)) {
                orderMap[name] = [dexIndex, entry.entry_number];
            }
        });
    }

    const regionName = vgData.regions.length > 0 ? vgData.regions[0].name : null;
    const versionNames = vgData.versions.map(v => v.name);

    return { speciesNames: [...speciesSet], versionGroupName: vgData.name, regionName, orderMap, versionNames };
}

// === Choisit la bonne variété d'une espèce pour la région active (forme régionale si elle existe) ===
function pickVarietyForRegion(speciesData, regionName) {
    if (regionName) {
        const regional = speciesData.varieties.find(v => v.pokemon.name.endsWith(`-${regionName}`));
        if (regional) return { variety: regional, isRegionalForm: true };
    }
    const defaultVariety = speciesData.varieties.find(v => v.is_default) || speciesData.varieties[0];
    return { variety: defaultVariety, isRegionalForm: false };
}

// === Construit la table espèce -> Pokémon à partir de allPokemon (toujours nécessaire) ===
function buildNameToPoke() {
    nameToPoke = {};
    allPokemon.forEach(p => { nameToPoke[p.speciesName] = p; });
}

// === Construit evolutionMap à partir des chaînes brutes en cache (chargement live uniquement) ===
function buildEvolutionMapFromChains() {
    evolutionMap = {};

    function walk(node) {
        if (node.evolves_to.length > 0) {
            evolutionMap[node.species.name] = node.evolves_to.map(child => ({
                toName: child.species.name,
                method: describeEvolutionMethod(child.evolution_details[0])
            }));
        }
        node.evolves_to.forEach(walk);
    }

    Object.values(evolutionChainCache).forEach(chainData => {
        walk(chainData.chain);
    });
}

// === Construit parentMap (enfant -> parent) à partir de evolutionMap, quelle que soit son origine ===
function buildParentMap() {
    parentMap = {};
    Object.entries(evolutionMap).forEach(([parent, children]) => {
        children.forEach(c => { parentMap[c.toName] = parent; });
    });
}

// === Noms français (capacités, talents, objets, lieux, versions) : data/names.json, chargé une seule fois ===
let namesPromise = null;

function loadNamesData() {
    if (!namesPromise) {
        namesPromise = tryLoadJson('data/names.json').then(data => {
            if (data) frNames = { ...frNames, ...data };
            return frNames;
        });
    }
    return namesPromise;
}

// === Rend actif un jeu déjà chargé (depuis le cache mémoire) ===
function activateGame(entry) {
    allPokemon = entry.pokemon;
    currentVersionGroupName = entry.versionGroupName;
    currentRegionName = entry.regionName;
    currentGameVersions = entry.versionNames || [];
    evolutionMap = entry.evolutionMap || {};
    gameExtra = entry.extra || null;
    buildNameToPoke();
    buildParentMap();
}

// === Charge tous les Pokémon disponibles dans un jeu donné, triés dans l'ordre du Pokédex régional ===
// Ordre de priorité : cache mémoire (déjà visité cette session) > fichier local > API en direct.
// Les données complémentaires (data/extra/{jeu}.json) sont chargées en parallèle.
async function loadGame(versionSlug) {
    if (gameCache[versionSlug]) {
        activateGame(gameCache[versionSlug]);
        afterGameLoaded();
        return;
    }

    gameSelect.disabled = true;
    pokedexList.innerHTML = '<p>Chargement...</p>';

    // 1. Essaye d'abord les fichiers locaux
    gameLoadingIndicator.textContent = 'Chargement des données...';
    const [fileData, extra] = await Promise.all([
        tryLoadJson(`data/${versionSlug}.json`),
        tryLoadJson(`data/extra/${versionSlug}.json`),
        loadNamesData()
    ]);

    if (fileData) {
        await applyGenerationRules(fileData.pokemon, versionSlug);
        gameCache[versionSlug] = {
            pokemon: fileData.pokemon,
            versionGroupName: fileData.versionGroupName,
            regionName: fileData.regionName,
            versionNames: fileData.versionNames || [],
            evolutionMap: fileData.evolutionMap,
            extra
        };
        activateGame(gameCache[versionSlug]);
        gameSelect.disabled = false;
        gameLoadingIndicator.textContent = '';
        afterGameLoaded();
        return;
    }

    // 2. Sinon, chargement en direct depuis PokéAPI
    gameLoadingIndicator.textContent = 'Chargement du jeu depuis l\'API...';

    try {
        const { speciesNames, versionGroupName, regionName, orderMap, versionNames } = await getGameSpeciesInfo(versionSlug);

        // 10 espèces chargées en parallèle au maximum (chaque espèce demande plusieurs requêtes)
        const results = await mapWithConcurrencyBrowser(speciesNames, 10, async (name) => {
            try {
                const speciesData = await getSpeciesData(`https://pokeapi.co/api/v2/pokemon-species/${name}`);
                const frenchNameBase = getFrenchNameFromSpecies(speciesData);
                const isFinal = await isFinalStage(speciesData);
                const isLegendary = speciesData.is_legendary || speciesData.is_mythical;

                const { variety, isRegionalForm } = pickVarietyForRegion(speciesData, regionName);

                const pokeRes = await fetch(variety.pokemon.url);
                if (!pokeRes.ok) return null;
                const pokeData = await pokeRes.json();

                const frenchTypes = await Promise.all(
                    pokeData.types.map(t => getFrenchType(t.type.url, t.type.name))
                );

                const frenchName = isRegionalForm
                    ? `${frenchNameBase} ${regionalFormSuffix(regionName)}`
                    : frenchNameBase;

                const abilities = pokeData.abilities.map(a => ({
                    name: a.ability.name,
                    url: a.ability.url,
                    isHidden: a.is_hidden
                }));

                const varieties = speciesData.varieties.map(v => v.pokemon.name);

                return {
                    ...pokeData,
                    id: speciesData.id,
                    speciesName: name,
                    frenchName,
                    frenchTypes,
                    isFinal,
                    isLegendary,
                    abilities,
                    varieties
                };
            } catch (e) {
                console.warn(`Impossible de charger ${name}`, e);
                return null;
            }
        });

        allPokemon = results.filter(Boolean).sort((a, b) => {
            const orderA = orderMap[a.speciesName] || [Infinity, Infinity];
            const orderB = orderMap[b.speciesName] || [Infinity, Infinity];
            if (orderA[0] !== orderB[0]) return orderA[0] - orderB[0];
            return orderA[1] - orderB[1];
        });
        await applyGenerationRules(allPokemon, versionSlug);

        buildEvolutionMapFromChains();

        gameCache[versionSlug] = {
            pokemon: allPokemon,
            versionGroupName,
            regionName,
            versionNames,
            evolutionMap,
            extra
        };
        activateGame(gameCache[versionSlug]);
    } catch (error) {
        console.error('Erreur lors du chargement du jeu:', error);
        pokedexList.innerHTML = '<p>Erreur lors du chargement de ce jeu.</p>';
        gameSelect.disabled = false;
        gameLoadingIndicator.textContent = '';
        return;
    }

    gameSelect.disabled = false;
    gameLoadingIndicator.textContent = '';
    afterGameLoaded();
}

// === Réinitialise tous les onglets après le chargement d'un nouveau jeu ===
function afterGameLoaded() {
    currentGeneration = getGameGeneration(gameSelect.value);
    setActiveTeamForGame(gameSelect.value);
    updateTeamDisplay();
    searchInput.value = '';
    populateTypeFilter();

    currentLocationSpeciesNames = null;
    locationFilter.innerHTML = '<option value="">Toutes les zones</option>';
    populateLocationFilter(currentRegionName, gameSelect.value);

    applyFilters(); // garde le filtre par statut choisi
    refreshCalculatorForGame();

    evolutionSearchInput.value = '';
    evolutionSearchResult.innerHTML = '';

    statsSelectedPoke1 = null;
    statsSelectedPoke2 = null;
    statsPoke1Input.value = '';
    statsPoke2Input.value = '';
    closeAutocomplete(statsPoke1Input, statsPoke1Results);
    closeAutocomplete(statsPoke2Input, statsPoke2Results);
    if (statsChartInstance) {
        statsChartInstance.destroy();
        statsChartInstance = null;
    }
    statsTableDisplay.innerHTML = '';
    abilitiesSectionDisplay.innerHTML = '';
    movesSectionDisplay.innerHTML = '';
    statsAddTeamBtn.style.display = 'none';
    statsTypesDisplay.textContent = '';
    statsDescription.textContent = '';

    megaListDisplay.innerHTML = '<p>Ouvre cet onglet pour charger les spécificités de ce jeu.</p>';
    specialFormsListDisplay.innerHTML = '';
    versionExclusivesDisplay.innerHTML = '';
    if (document.getElementById('specificities').classList.contains('active')) {
        loadSpecificities();
    }

    exportGameBtn.style.display = allPokemon.length > 0 ? 'inline-block' : 'none';
}

// === Affiche la jaquette du jeu sélectionné si elle existe dans covers/ (tente .jpg puis .png) ===
function updateGameCover(versionSlug) {
    gameCoverImg.onload = () => { gameCoverImg.style.display = 'inline-block'; };
    gameCoverImg.onerror = () => {
        if (gameCoverImg.dataset.triedPng !== '1') {
            gameCoverImg.dataset.triedPng = '1';
            gameCoverImg.src = `covers/${versionSlug}.png`;
        } else {
            gameCoverImg.style.display = 'none';
        }
    };
    gameCoverImg.dataset.triedPng = '0';
    gameCoverImg.src = `covers/${versionSlug}.jpg`;
}

gameSelect.addEventListener('change', () => {
    writeStorage('lastGame', gameSelect.value);
    updateGameCover(gameSelect.value);
    loadGame(gameSelect.value);
});

// === Nom affiché du jeu sélectionné (ex : "Rouge / Bleu") ===
function currentGameLabel() {
    const option = gameSelect.options[gameSelect.selectedIndex];
    return option ? option.textContent : gameSelect.value;
}

// === Export : télécharge les données du jeu actif en JSON (à placer dans un dossier data/) ===
function exportGameData() {
    if (allPokemon.length === 0) return;

    const exportObj = {
        versionSlug: gameSelect.value,
        versionGroupName: currentVersionGroupName,
        regionName: currentRegionName,
        versionNames: currentGameVersions,
        pokemon: allPokemon,
        evolutionMap
    };

    downloadJson(exportObj, `${gameSelect.value}.json`);

    alert(`Fichier "${gameSelect.value}.json" téléchargé ! Place-le dans un dossier "data" à côté de index.html pour un chargement instantané la prochaine fois.`);
}

exportGameBtn.addEventListener('click', exportGameData);

// === Export : télécharge la table des types en JSON ===
function exportTypesData() {
    if (Object.keys(typeChart).length === 0) {
        alert('La table des types n\'est pas encore chargée, réessaie dans un instant.');
        return;
    }

    const exportObj = { typeChart, typeTranslations };

    downloadJson(exportObj, 'types.json');

    alert('Fichier "types.json" téléchargé ! Place-le dans le dossier "data" à côté de index.html.');
}

exportTypesBtn.addEventListener('click', exportTypesData);

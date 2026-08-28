// Éléments du DOM
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const searchInput = document.getElementById('search');
const typeFilter = document.getElementById('type-filter');
const locationFilter = document.getElementById('location-filter');
const locationLoadingIndicator = document.getElementById('location-loading-indicator');
const pokedexList = document.getElementById('pokedex-list');
const teamDisplay = document.getElementById('team-display');
const generateBtn = document.getElementById('generate-btn');
const avoidDuplicateTypes = document.getElementById('avoid-duplicate-types');
const finalStageOnly = document.getElementById('final-stage-only');
const excludeLegendary = document.getElementById('exclude-legendary');
const generatedTeamDisplay = document.getElementById('generated-team');
const addAllBtn = document.getElementById('add-all-btn');
const atkTypeSelect = document.getElementById('atk-type-select');
const defType1Select = document.getElementById('def-type1-select');
const defType2Select = document.getElementById('def-type2-select');
const calculateBtn = document.getElementById('calculate-btn');
const calcResult = document.getElementById('calc-result');
const evolutionsListDisplay = document.getElementById('evolutions-list');
const evolutionSearchInput = document.getElementById('evolution-search');
const evolutionSearchResult = document.getElementById('evolution-search-result');
const statsPoke1Input = document.getElementById('stats-poke1-input');
const statsPoke2Input = document.getElementById('stats-poke2-input');
const statsPoke1Results = document.getElementById('stats-poke1-results');
const statsPoke2Results = document.getElementById('stats-poke2-results');
const statsRadarCanvas = document.getElementById('stats-radar-chart');
const statsTableDisplay = document.getElementById('stats-table');
const statsAddTeamBtn = document.getElementById('stats-add-team-btn');
const statsTypesDisplay = document.getElementById('stats-types-display');
const abilitiesSectionDisplay = document.getElementById('abilities-section');
const movesSectionDisplay = document.getElementById('moves-section');
const gameSelect = document.getElementById('game-select');
const gameLoadingIndicator = document.getElementById('game-loading-indicator');
const gameCoverImg = document.getElementById('game-cover-img');
const megaListDisplay = document.getElementById('mega-list');
const specialFormsListDisplay = document.getElementById('special-forms-list');
const versionExclusivesDisplay = document.getElementById('version-exclusives');
const exportGameBtn = document.getElementById('export-game-btn');
const exportTypesBtn = document.getElementById('export-types-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// État de l'app
let allPokemon = [];
let userTeam = JSON.parse(localStorage.getItem('userTeam')) || [];
let currentGeneratedTeam = [];
const typeTranslations = {}; // cache des traductions de types
const evolutionChainCache = {}; // cache des chaînes d'évolution brutes (par URL), utilisé uniquement lors d'un chargement API live
const moveNameTranslations = {}; // cache des traductions de capacités (nom anglais -> français), partagé entre tous les jeux
const abilityNameTranslations = {}; // cache des traductions de talents (nom anglais -> français), partagé entre tous les jeux
let typeChart = {}; // relations de dégâts par type (en anglais)
let nameToPoke = {}; // nom d'ESPÈCE (anglais) -> objet Pokémon complet (pour le jeu actif)
let evolutionMap = {}; // nom d'espèce (anglais) -> [{ toName, method }] (pour le jeu actif)
let parentMap = {}; // nom d'espèce enfant -> nom d'espèce parent (pour le jeu actif)
let statsChartInstance = null;
let statsSelectedPoke1 = null;
let statsSelectedPoke2 = null;
const gameCache = {}; // cache par jeu : { pokemon, versionGroupName, regionName, evolutionMap, versionNames }
let currentVersionGroupName = null; // version_group du jeu actif (pour filtrer les capacités)
let currentRegionName = null; // région associée au jeu actif (pour le filtre par zone et les formes régionales)
let currentGameVersions = []; // noms des versions individuelles du jeu actif (ex: ['red','blue'])
const locationsCache = {}; // cache des listes de zones (avec Pokémon) par "région::version"
const locationPokemonCache = {}; // cache des Pokémon par zone (clé: "location::version")
let currentLocationSpeciesNames = null; // Set des noms de Pokémon (forme incluse) disponibles dans la zone sélectionnée (null = pas de filtre)
const specificitiesCache = {}; // cache par jeu : { megas, specialForms, exclusives }
const encounterVersionsCache = {}; // cache des versions de rencontre par nom de pokémon (clé: nom du pokémon)

// Jeux ayant la mécanique de méga-évolution (génération 6-7 seulement)
const GAMES_WITH_MEGA = new Set(['x', 'omega-ruby', 'sun', 'ultra-sun']);

// Petite liste connue de formes spéciales liées à un jeu précis (non exhaustive)
const SPECIAL_FORMS_DB = [
    { speciesName: 'necrozma', formLabel: 'Formes de fusion (Crin du Crépuscule / Ailes de l\'Aube)', games: ['ultra-sun'] },
    { speciesName: 'zygarde', formLabel: 'Forme 10% / Complète (via Cube Zygarde)', games: ['sun', 'ultra-sun'] },
    { speciesName: 'kyurem', formLabel: 'Kyurem Blanc / Noir (fusion)', games: ['black-2'] },
    { speciesName: 'giratina', formLabel: 'Forme Originelle', games: ['platinum'] }
];

// Libellés français pour les formes régionales
const regionFormLabelsFr = {
    alola: 'Alola',
    galar: 'Galar',
    hisui: 'Hisui',
    paldea: 'Paldea'
};

// === Mode sombre : bascule et sauvegarde de la préférence ===
function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    themeToggleBtn.textContent = isDark ? '☀️ Mode clair' : '🌙 Mode sombre';
    localStorage.setItem('darkMode', isDark ? '1' : '0');
}

themeToggleBtn.addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('dark-mode'));
});

applyTheme(localStorage.getItem('darkMode') === '1');

// === Navigation par onglets ===
function switchToTab(tabName) {
    tabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === tabName));
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        switchToTab(tabName);
        if (tabName === 'specificities') loadSpecificities();
    });
});

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

// === Tente de charger les données d'un jeu depuis un fichier local (data/{slug}.json) ===
async function tryLoadGameFromFile(versionSlug) {
    try {
        const res = await fetch(`data/${versionSlug}.json`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// === Tente de charger la table des types depuis un fichier local (data/types.json) ===
async function tryLoadTypesFromFile() {
    try {
        const res = await fetch('data/types.json');
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// === Charge tous les Pokémon disponibles dans un jeu donné, triés dans l'ordre du Pokédex régional ===
// Ordre de priorité : cache mémoire (déjà visité cette session) > fichier local > API en direct
async function loadGame(versionSlug) {
    if (gameCache[versionSlug]) {
        const cached = gameCache[versionSlug];
        allPokemon = cached.pokemon;
        currentVersionGroupName = cached.versionGroupName;
        currentRegionName = cached.regionName;
        currentGameVersions = cached.versionNames || [];
        evolutionMap = cached.evolutionMap;
        buildNameToPoke();
        buildParentMap();
        afterGameLoaded();
        return;
    }

    gameSelect.disabled = true;
    pokedexList.innerHTML = '<p>Chargement...</p>';

    // 1. Essaye d'abord un fichier local exporté précédemment
    gameLoadingIndicator.textContent = 'Recherche d\'un fichier local...';
    const fileData = await tryLoadGameFromFile(versionSlug);

    if (fileData) {
        gameLoadingIndicator.textContent = '⚡ Chargé depuis un fichier local';
        allPokemon = fileData.pokemon;
        currentVersionGroupName = fileData.versionGroupName;
        currentRegionName = fileData.regionName;
        currentGameVersions = fileData.versionNames || [];
        evolutionMap = fileData.evolutionMap;
        buildNameToPoke();
        buildParentMap();
        gameCache[versionSlug] = {
            pokemon: allPokemon,
            versionGroupName: currentVersionGroupName,
            regionName: currentRegionName,
            versionNames: currentGameVersions,
            evolutionMap
        };
        gameSelect.disabled = false;
        setTimeout(() => { gameLoadingIndicator.textContent = ''; }, 2000);
        afterGameLoaded();
        return;
    }

    // 2. Sinon, chargement en direct depuis PokéAPI
    gameLoadingIndicator.textContent = 'Chargement du jeu depuis l\'API...';

    try {
        const { speciesNames, versionGroupName, regionName, orderMap, versionNames } = await getGameSpeciesInfo(versionSlug);

        const results = await Promise.all(
            speciesNames.map(async (name) => {
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
                        ? `${frenchNameBase} (Forme de ${regionFormLabelsFr[regionName] || regionName})`
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
            })
        );

        allPokemon = results.filter(Boolean).sort((a, b) => {
            const orderA = orderMap[a.speciesName] || [Infinity, Infinity];
            const orderB = orderMap[b.speciesName] || [Infinity, Infinity];
            if (orderA[0] !== orderB[0]) return orderA[0] - orderB[0];
            return orderA[1] - orderB[1];
        });

        currentVersionGroupName = versionGroupName;
        currentRegionName = regionName;
        currentGameVersions = versionNames;

        buildEvolutionMapFromChains();
        buildNameToPoke();
        buildParentMap();

        gameCache[versionSlug] = {
            pokemon: allPokemon,
            versionGroupName,
            regionName,
            versionNames,
            evolutionMap
        };
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
    searchInput.value = '';
    populateTypeFilter();

    currentLocationSpeciesNames = null;
    locationFilter.innerHTML = '<option value="">Toutes les zones</option>';
    if (currentRegionName) {
        populateLocationFilter(currentRegionName, gameSelect.value);
    }

    displayPokemon(allPokemon);

    evolutionSearchInput.value = '';
    evolutionSearchResult.innerHTML = '';
    renderEvolutionsTab();

    statsSelectedPoke1 = null;
    statsSelectedPoke2 = null;
    statsPoke1Input.value = '';
    statsPoke2Input.value = '';
    statsPoke1Results.innerHTML = '';
    statsPoke2Results.innerHTML = '';
    if (statsChartInstance) {
        statsChartInstance.destroy();
        statsChartInstance = null;
    }
    statsTableDisplay.innerHTML = '';
    abilitiesSectionDisplay.innerHTML = '';
    movesSectionDisplay.innerHTML = '';
    statsAddTeamBtn.style.display = 'none';
    statsTypesDisplay.textContent = '';

    megaListDisplay.innerHTML = '<p>Ouvre cet onglet pour charger les spécificités de ce jeu.</p>';
    specialFormsListDisplay.innerHTML = '';
    versionExclusivesDisplay.innerHTML = '';
    if (document.getElementById('specificities').classList.contains('active')) {
        loadSpecificities();
    }

    exportGameBtn.style.display = allPokemon.length > 0 ? 'inline-block' : 'none';
}

// === Affiche la jaquette du jeu sélectionné si elle existe dans covers/ (tente .png puis .jpg) ===
function updateGameCover(versionSlug) {
    gameCoverImg.onload = () => { gameCoverImg.style.display = 'inline-block'; };
    gameCoverImg.onerror = () => {
        if (gameCoverImg.dataset.triedJpg !== '1') {
            gameCoverImg.dataset.triedJpg = '1';
            gameCoverImg.src = `covers/${versionSlug}.jpg`;
        } else {
            gameCoverImg.style.display = 'none';
        }
    };
    gameCoverImg.dataset.triedJpg = '0';
    gameCoverImg.src = `covers/${versionSlug}.png`;
}

gameSelect.addEventListener('change', () => {
    updateGameCover(gameSelect.value);
    loadGame(gameSelect.value);
});

// === Export : télécharge les données du jeu actif en JSON (à placer dans un dossier data/) ===
function exportGameData() {
    if (allPokemon.length === 0) return;

    const exportObj = {
        versionSlug: gameSelect.value,
        versionGroupName: currentVersionGroupName,
        regionName: currentRegionName,
        pokemon: allPokemon,
        evolutionMap
    };

    const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameSelect.value}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

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

    const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'types.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Fichier "types.json" téléchargé ! Place-le dans le dossier "data" à côté de index.html.');
}

exportTypesBtn.addEventListener('click', exportTypesData);

// === Formate un nom de zone (slug anglais) en libellé lisible, utilisé seulement si pas de traduction FR ===
function formatLocationName(slug) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// === Construit la liste des zones d'une région qui contiennent au moins un Pokémon pour le jeu donné ===
async function buildLocationsWithPokemon(regionName, versionSlug) {
    const cacheKey = `${regionName}::${versionSlug}`;
    if (locationsCache[cacheKey]) return locationsCache[cacheKey];

    const regionRes = await fetch(`https://pokeapi.co/api/v2/region/${regionName}`);
    const regionData = await regionRes.json();

    const locationResults = await Promise.all(
        regionData.locations.map(async (loc) => {
            try {
                const locRes = await fetch(loc.url);
                const locData = await locRes.json();

                const speciesSet = new Set();

                await Promise.all(locData.areas.map(async (area) => {
                    const areaRes = await fetch(area.url);
                    const areaData = await areaRes.json();
                    areaData.pokemon_encounters.forEach(enc => {
                        const availableHere = enc.version_details.some(vd => vd.version.name === versionSlug);
                        if (availableHere) speciesSet.add(enc.pokemon.name);
                    });
                }));

                if (speciesSet.size === 0) return null;

                locationPokemonCache[`${loc.name}::${versionSlug}`] = speciesSet;

                const frEntry = locData.names.find(n => n.language.name === 'fr');
                const label = frEntry ? frEntry.name : formatLocationName(loc.name);

                return { name: loc.name, label };
            } catch (e) {
                console.warn(`Impossible de charger la zone ${loc.name}`, e);
                return null;
            }
        })
    );

    const locations = locationResults.filter(Boolean).sort((a, b) => a.label.localeCompare(b.label));
    locationsCache[cacheKey] = locations;
    return locations;
}

// === Remplit le menu déroulant des zones (avec Pokémon uniquement) pour la région/jeu actif ===
async function populateLocationFilter(regionName, versionSlug) {
    locationLoadingIndicator.textContent = 'Préparation des zones...';
    locationFilter.disabled = true;

    let locations;
    try {
        locations = await buildLocationsWithPokemon(regionName, versionSlug);
    } catch (error) {
        console.error('Erreur lors du chargement des zones:', error);
        locationLoadingIndicator.textContent = '';
        locationFilter.disabled = false;
        return;
    }

    if (currentRegionName !== regionName || gameSelect.value !== versionSlug) return;

    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        option.textContent = loc.label;
        locationFilter.appendChild(option);
    });

    locationLoadingIndicator.textContent = '';
    locationFilter.disabled = false;
}

locationFilter.addEventListener('change', () => {
    const locationName = locationFilter.value;

    if (!locationName) {
        currentLocationSpeciesNames = null;
        applyFilters();
        return;
    }

    const cacheKey = `${locationName}::${gameSelect.value}`;
    currentLocationSpeciesNames = locationPokemonCache[cacheKey] || new Set();
    applyFilters();
});

// === Récupère la meilleure image disponible pour un Pokémon (artwork officiel HD, sinon sprite classique) ===
function getArtworkUrl(poke) {
    if (!poke.sprites) return '';
    if (poke.sprites.official_artwork) return poke.sprites.official_artwork;
    if (poke.sprites.other && poke.sprites.other['official-artwork'] && poke.sprites.other['official-artwork'].front_default) {
        return poke.sprites.other['official-artwork'].front_default;
    }
    return poke.sprites.front_default || '';
}

// === Affichage des Pokémon ===
function displayPokemon(pokemonList) {
    if (pokemonList.length === 0) {
        pokedexList.innerHTML = '<p>Aucun Pokémon trouvé</p>';
        return;
    }

    pokedexList.innerHTML = pokemonList.map(poke => {
        const nationalLabel = `Nat. #${poke.id.toString().padStart(3, '0')}`;

        return `
            <div class="pokemon-card" onclick="selectPokemonInStats(${poke.id})">
                <img src="${getArtworkUrl(poke)}" alt="${poke.frenchName}">
                <h3>${poke.frenchName}</h3>
                <p><span class="national-num">(${nationalLabel})</span></p>
                <p class="types">${poke.frenchTypes.join(', ')}</p>
            </div>
        `;
    }).join('');
}

// === Clic sur une carte du Pokédex : redirige vers Statistiques et Capacités avec ce Pokémon sélectionné ===
function selectPokemonInStats(id) {
    const poke = allPokemon.find(p => p.id === id);
    if (!poke) return;

    switchToTab('stats');

    statsSelectedPoke1 = id;
    statsPoke1Input.value = poke.frenchName;
    statsPoke1Results.innerHTML = '';
    updateStatsChart();
}

// === Filtrage combiné (recherche + type + zone) ===
function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const selectedType = typeFilter.value;

    const filtered = allPokemon.filter(poke => {
        const matchesSearch = poke.frenchName.toLowerCase().includes(query) || poke.id.toString().includes(query);
        const matchesType = !selectedType || poke.types.some(t => t.type.name === selectedType);
        const matchesLocation = !currentLocationSpeciesNames || currentLocationSpeciesNames.has(poke.name);
        return matchesSearch && matchesType && matchesLocation;
    });

    displayPokemon(filtered);
}

searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);

// === Gestion de l'équipe ===
function addToTeam(id, name, image, types) {
    if (userTeam.length >= 6) {
        alert('Équipe complète ! (6 Pokémon max)');
        return;
    }

    if (userTeam.some(p => p.id === id)) {
        alert('Ce Pokémon est déjà dans votre équipe');
        return;
    }

    userTeam.push({ id, name, image, types });
    saveTeam();
    updateTeamDisplay();
}

function removeFromTeam(id) {
    userTeam = userTeam.filter(p => p.id !== id);
    saveTeam();
    updateTeamDisplay();
}

function saveTeam() {
    localStorage.setItem('userTeam', JSON.stringify(userTeam));
}

function updateTeamDisplay() {
    if (userTeam.length === 0) {
        teamDisplay.innerHTML = '<p>Aucun Pokémon ajouté. Clique sur un Pokémon dans le Pokédex pour le consulter, puis ajoute-le depuis l\'onglet Statistiques !</p>';
    } else {
        teamDisplay.innerHTML = userTeam.map(poke => `
            <div class="team-slot filled">
                <img src="${poke.image}" alt="${poke.name}">
                <h4>${poke.name}</h4>
                <p>#${poke.id}</p>
                <p class="types">${(poke.types && poke.types.length) ? poke.types.join(', ') : 'Type(s) inconnu(s)'}</p>
                <button class="remove-btn" onclick="removeFromTeam(${poke.id})">Supprimer</button>
            </div>
        `).join('');
    }

    renderEvolutionsTab();
}

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

function displayGeneratedTeam(team) {
    generatedTeamDisplay.innerHTML = team.map(poke => `
        <div class="pokemon-card">
            <img src="${getArtworkUrl(poke)}" alt="${poke.frenchName}">
            <h3>${poke.frenchName}</h3>
            <p>#${poke.id.toString().padStart(3, '0')}</p>
            <p class="types">${poke.frenchTypes.join(', ')}</p>
        </div>
    `).join('');

    addAllBtn.style.display = team.length > 0 ? 'block' : 'none';
}

function addGeneratedTeamToMyTeam() {
    if (currentGeneratedTeam.length === 0) return;

    userTeam = currentGeneratedTeam.map(poke => ({
        id: poke.id,
        name: poke.frenchName,
        image: getArtworkUrl(poke),
        types: poke.frenchTypes
    }));

    saveTeam();
    updateTeamDisplay();
    alert('Équipe ajoutée à "Mon Équipe" !');
}

generateBtn.addEventListener('click', generateTeam);
addAllBtn.addEventListener('click', addGeneratedTeamToMyTeam);

// === Calculatrice de combat : chargement de la table des types (fichier local si dispo, sinon API) ===
async function loadTypeChart() {
    const fileData = await tryLoadTypesFromFile();

    if (fileData) {
        Object.assign(typeChart, fileData.typeChart);
        Object.assign(typeTranslations, fileData.typeTranslations);
        populateCalcTypeSelects(Object.keys(typeChart));
        return;
    }

    try {
        const response = await fetch('https://pokeapi.co/api/v2/type?limit=20');
        const data = await response.json();

        const validTypes = data.results.filter(t => t.name !== 'unknown' && t.name !== 'shadow');

        const typeDataList = await Promise.all(
            validTypes.map(async (t) => {
                const res = await fetch(t.url);
                return res.json();
            })
        );

        typeDataList.forEach(t => {
            const frEntry = t.names.find(n => n.language.name === 'fr');
            typeTranslations[t.name] = frEntry ? frEntry.name : t.name;

            typeChart[t.name] = {
                double_damage_to: t.damage_relations.double_damage_to.map(d => d.name),
                half_damage_to: t.damage_relations.half_damage_to.map(d => d.name),
                no_damage_to: t.damage_relations.no_damage_to.map(d => d.name)
            };
        });

        populateCalcTypeSelects(typeDataList.map(t => t.name));
    } catch (error) {
        console.error('Erreur lors du chargement de la table des types:', error);
    }
}

function populateCalcTypeSelects(typeNames) {
    const sorted = typeNames
        .map(name => ({ name, fr: typeTranslations[name] }))
        .sort((a, b) => a.fr.localeCompare(b.fr));

    sorted.forEach(({ name, fr }) => {
        const opt1 = document.createElement('option');
        opt1.value = name;
        opt1.textContent = fr;
        atkTypeSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = name;
        opt2.textContent = fr;
        defType1Select.appendChild(opt2);

        const opt3 = document.createElement('option');
        opt3.value = name;
        opt3.textContent = fr;
        defType2Select.appendChild(opt3);
    });
}

// === Calculatrice de combat : calcul du multiplicateur ===
function getMultiplier(atkType, defType) {
    const relations = typeChart[atkType];
    if (!relations) return 1;

    if (relations.no_damage_to.includes(defType)) return 0;
    if (relations.double_damage_to.includes(defType)) return 2;
    if (relations.half_damage_to.includes(defType)) return 0.5;
    return 1;
}

function calculateEffectiveness() {
    const atkType = atkTypeSelect.value;
    const defType1 = defType1Select.value;
    const defType2 = defType2Select.value;

    if (!atkType || !defType1) {
        calcResult.textContent = 'Choisis au moins le type d\'attaque et un type défenseur.';
        calcResult.className = 'calc-result show effect-none';
        return;
    }

    let multiplier = getMultiplier(atkType, defType1);
    if (defType2) {
        multiplier *= getMultiplier(atkType, defType2);
    }

    let message = '';
    let effectClass = '';

    if (multiplier === 0) {
        message = `Aucun effet ⛔ (x${multiplier})`;
        effectClass = 'effect-none';
    } else if (multiplier < 1) {
        message = `Pas très efficace (x${multiplier})`;
        effectClass = 'effect-not-very';
    } else if (multiplier === 1) {
        message = `Efficacité normale (x${multiplier})`;
        effectClass = 'effect-normal';
    } else {
        message = `Super efficace ⚡ (x${multiplier})`;
        effectClass = 'effect-super';
    }

    calcResult.textContent = message;
    calcResult.className = `calc-result show ${effectClass}`;
}

calculateBtn.addEventListener('click', calculateEffectiveness);

// === Tracker d'évolutions ===

const itemNamesFr = {
    'fire-stone': 'Pierre Feu',
    'water-stone': 'Pierre Eau',
    'thunder-stone': 'Pierre Foudre',
    'leaf-stone': 'Pierre Plante',
    'moon-stone': 'Pierre Lune',
    'sun-stone': 'Pierre Soleil',
    'shiny-stone': 'Pierre Éclat',
    'dusk-stone': 'Pierre Nuit',
    'dawn-stone': 'Pierre Aube',
    'ice-stone': 'Pierre Glace',
    'kings-rock': 'Roche Royale',
    'metal-coat': 'Armure Métal',
    'dragon-scale': 'Écaille Dragon',
    'up-grade': 'Améliorator',
    'protector': 'Protecteur',
    'electirizer': 'Électrisant',
    'magmarizer': 'Magmatisant',
    'oval-stone': 'Pierre Ovale',
    'razor-claw': 'Griffe Affûtée',
    'razor-fang': 'Croc Affûté',
    'prism-scale': 'Écaille Prisme'
};

function itemNameFr(slug) {
    return itemNamesFr[slug] || slug;
}

// === Décrit en français la condition d'évolution (utilisé lors du chargement live uniquement) ===
function describeEvolutionMethod(details) {
    if (!details || !details.trigger) return 'Condition inconnue';

    const trigger = details.trigger.name;

    if (trigger === 'level-up') {
        const parts = [];
        if (details.min_level) parts.push(`Niveau ${details.min_level}`);
        if (details.min_happiness) parts.push('Bonheur élevé');
        if (details.min_affection) parts.push('Affection élevée');
        if (details.time_of_day) parts.push(details.time_of_day === 'day' ? 'Le jour' : 'La nuit');
        if (details.known_move) parts.push('Connaître une capacité spécifique');
        if (details.location) parts.push('Dans un lieu spécifique');
        if (parts.length === 0) parts.push('Montée de niveau');
        return parts.join(' + ');
    }

    if (trigger === 'trade') {
        return details.held_item
            ? `Échange (en tenant ${itemNameFr(details.held_item.name)})`
            : 'Échange';
    }

    if (trigger === 'use-item') {
        return `Utiliser : ${itemNameFr(details.item.name)}`;
    }

    return trigger;
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

        const toTypesJs = `[${toPoke.frenchTypes.map(t => `'${t}'`).join(',')}]`;
        const buttonHtml = showButton
            ? `<button class="evolution-confirm-btn" onclick="markEvolved(${fromPoke.id}, ${toPoke.id}, '${toPoke.frenchName}', '${getArtworkUrl(toPoke)}', ${toTypesJs})">✅ Marquer comme évolué</button>`
            : '';

        return `
            <div class="evolution-card">
                <div class="evolution-mon">
                    <img src="${getArtworkUrl(fromPoke)}" alt="${fromPoke.frenchName}">
                    <span>${fromPoke.frenchName}</span>
                </div>
                <div class="evolution-arrow">➜</div>
                <div class="evolution-mon">
                    <img src="${getArtworkUrl(toPoke)}" alt="${toPoke.frenchName}">
                    <span>${toPoke.frenchName}</span>
                </div>
                <div class="evolution-info">
                    <p class="evolution-method">Condition : ${edge.method}</p>
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

    const teamInThisGame = userTeam.filter(teamMon => allPokemon.some(p => p.id === teamMon.id));

    if (teamInThisGame.length === 0) {
        evolutionsListDisplay.innerHTML = '<p class="evolutions-empty">Ajoute des Pokémon présents dans ce jeu à "Mon Équipe" pour voir leurs évolutions possibles.</p>';
        return;
    }

    const edges = [];

    teamInThisGame.forEach(teamMon => {
        const poke = allPokemon.find(p => p.id === teamMon.id);
        if (!poke) return;

        const evolutions = evolutionMap[poke.speciesName] || [];
        evolutions.forEach(evo => {
            edges.push({ fromName: poke.speciesName, toName: evo.toName, method: evo.method });
        });
    });

    renderEvolutionRows(edges, evolutionsListDisplay, 'Tous les Pokémon de ton équipe (présents dans ce jeu) sont déjà à leur forme finale ! 🎉', true);
}

// === Marque un Pokémon de l'équipe comme évolué (remplace son entrée) ===
function markEvolved(oldId, newId, newName, newImage, newTypes) {
    const idx = userTeam.findIndex(p => p.id === oldId);
    if (idx === -1) return;

    userTeam[idx] = { id: newId, name: newName, image: newImage, types: newTypes };
    saveTeam();
    updateTeamDisplay();
}

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
    const query = evolutionSearchInput.value.toLowerCase().trim();

    if (!query) {
        evolutionSearchResult.innerHTML = '';
        return;
    }

    if (allPokemon.length === 0) {
        evolutionSearchResult.innerHTML = '<p class="evolutions-empty">Chargement...</p>';
        return;
    }

    const match = allPokemon.find(p =>
        p.frenchName.toLowerCase().includes(query) || p.id.toString() === query
    );

    if (!match) {
        evolutionSearchResult.innerHTML = '<p class="evolutions-empty">Aucun Pokémon trouvé dans ce jeu.</p>';
        return;
    }

    const rootName = findRootSpecies(match.speciesName);
    const edges = getChainEdgesFromMap(rootName);
    renderEvolutionRows(edges, evolutionSearchResult, `${match.frenchName} n'évolue pas.`, false);
}

evolutionSearchInput.addEventListener('input', performEvolutionSearch);

// === Statistiques et Capacités : radar chart ===
const statNamesFr = {
    hp: 'PV',
    attack: 'Attaque',
    defense: 'Défense',
    'special-attack': 'Attaque Spé.',
    'special-defense': 'Défense Spé.',
    speed: 'Vitesse'
};
const statOrder = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

function getStatValues(poke) {
    return statOrder.map(statName => {
        const found = poke.stats.find(s => s.stat.name === statName);
        return found ? found.base_stat : 0;
    });
}

function renderStatsAutocomplete(query, resultsEl, onSelect) {
    if (!query.trim()) {
        resultsEl.innerHTML = '';
        return;
    }

    if (allPokemon.length === 0) {
        resultsEl.innerHTML = '<div class="autocomplete-item no-result">Chargement...</div>';
        return;
    }

    const q = query.toLowerCase().trim();
    const matches = allPokemon
        .filter(p => p.frenchName.toLowerCase().includes(q) || p.id.toString() === q)
        .slice(0, 8);

    if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="autocomplete-item no-result">Aucun résultat</div>';
        return;
    }

    resultsEl.innerHTML = matches.map(p => `
        <div class="autocomplete-item" data-id="${p.id}">#${p.id.toString().padStart(3, '0')} ${p.frenchName}</div>
    `).join('');

    resultsEl.querySelectorAll('.autocomplete-item[data-id]').forEach(item => {
        item.addEventListener('click', () => {
            onSelect(parseInt(item.dataset.id));
            resultsEl.innerHTML = '';
        });
    });
}

statsPoke1Input.addEventListener('input', () => {
    if (!statsPoke1Input.value.trim()) {
        statsSelectedPoke1 = null;
        updateStatsChart();
    }
    renderStatsAutocomplete(statsPoke1Input.value, statsPoke1Results, (id) => {
        statsSelectedPoke1 = id;
        const p = allPokemon.find(x => x.id === id);
        statsPoke1Input.value = p.frenchName;
        updateStatsChart();
    });
});

statsPoke2Input.addEventListener('input', () => {
    if (!statsPoke2Input.value.trim()) {
        statsSelectedPoke2 = null;
        updateStatsChart();
    }
    renderStatsAutocomplete(statsPoke2Input.value, statsPoke2Results, (id) => {
        statsSelectedPoke2 = id;
        const p = allPokemon.find(x => x.id === id);
        statsPoke2Input.value = p.frenchName;
        updateStatsChart();
    });
});

document.addEventListener('click', (e) => {
    if (!statsPoke1Input.contains(e.target) && !statsPoke1Results.contains(e.target)) {
        statsPoke1Results.innerHTML = '';
    }
    if (!statsPoke2Input.contains(e.target) && !statsPoke2Results.contains(e.target)) {
        statsPoke2Results.innerHTML = '';
    }
});

statsAddTeamBtn.addEventListener('click', () => {
    if (!statsSelectedPoke1) return;
    const poke = allPokemon.find(p => p.id === statsSelectedPoke1);
    if (!poke) return;
    addToTeam(poke.id, poke.frenchName, getArtworkUrl(poke), poke.frenchTypes);
});

function updateStatsChart() {
    if (!statsSelectedPoke1) {
        if (statsChartInstance) {
            statsChartInstance.destroy();
            statsChartInstance = null;
        }
        statsTableDisplay.innerHTML = '';
        abilitiesSectionDisplay.innerHTML = '';
        movesSectionDisplay.innerHTML = '';
        statsAddTeamBtn.style.display = 'none';
        statsTypesDisplay.textContent = '';
        return;
    }

    const poke1 = allPokemon.find(p => p.id === statsSelectedPoke1);
    const poke2 = statsSelectedPoke2 ? allPokemon.find(p => p.id === statsSelectedPoke2) : null;

    statsAddTeamBtn.textContent = `Ajouter ${poke1.frenchName} à "Mon Équipe"`;
    statsAddTeamBtn.style.display = 'block';

    let typesText = `Type(s) de ${poke1.frenchName} : ${poke1.frenchTypes.join(', ')}`;
    if (poke2) {
        typesText += `  |  Type(s) de ${poke2.frenchName} : ${poke2.frenchTypes.join(', ')}`;
    }
    statsTypesDisplay.textContent = typesText;

    const labels = statOrder.map(s => statNamesFr[s]);
    const values1 = getStatValues(poke1);

    const datasets = [{
        label: poke1.frenchName,
        data: values1,
        backgroundColor: 'rgba(102, 126, 234, 0.25)',
        borderColor: 'rgba(102, 126, 234, 1)',
        pointBackgroundColor: 'rgba(102, 126, 234, 1)'
    }];

    let values2 = null;
    if (poke2) {
        values2 = getStatValues(poke2);
        datasets.push({
            label: poke2.frenchName,
            data: values2,
            backgroundColor: 'rgba(255, 165, 0, 0.25)',
            borderColor: 'rgba(255, 165, 0, 1)',
            pointBackgroundColor: 'rgba(255, 165, 0, 1)'
        });
    }

    if (statsChartInstance) {
        statsChartInstance.destroy();
    }

    statsChartInstance = new Chart(statsRadarCanvas, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    suggestedMax: 150
                }
            }
        }
    });

    let rowsHtml = `<table class="stats-data-table"><thead><tr><th>Statistique</th><th>${poke1.frenchName}</th>${poke2 ? `<th>${poke2.frenchName}</th>` : ''}</tr></thead><tbody>`;
    statOrder.forEach((statName, i) => {
        rowsHtml += `<tr><td>${statNamesFr[statName]}</td><td>${values1[i]}</td>${poke2 ? `<td>${values2[i]}</td>` : ''}</tr>`;
    });
    rowsHtml += '</tbody></table>';
    statsTableDisplay.innerHTML = rowsHtml;

    renderAbilitiesSection(poke1);
    renderMovesSection(poke1);
}

// === Talents : traduction française d'un talent (avec cache) ===
async function getFrenchAbilityName(abilityUrl, abilityNameEn) {
    if (abilityNameTranslations[abilityNameEn]) return abilityNameTranslations[abilityNameEn];

    const res = await fetch(abilityUrl);
    const data = await res.json();
    const frEntry = data.names.find(n => n.language.name === 'fr');
    const frName = frEntry ? frEntry.name : abilityNameEn;
    abilityNameTranslations[abilityNameEn] = frName;
    return frName;
}

// === Talents : affiche la section sous les stats pour le Pokémon sélectionné ===
async function renderAbilitiesSection(poke) {
    if (!poke.abilities) {
        abilitiesSectionDisplay.innerHTML = `
            <h3>Talents</h3>
            <p class="evolutions-empty">Talents non disponibles pour ce Pokémon (fichier local généré avant l'ajout de cette fonctionnalité). Supprime data/${gameSelect.value}.json et relance l'export pour les inclure.</p>
        `;
        return;
    }

    abilitiesSectionDisplay.innerHTML = '<p class="calc-intro">Chargement des talents...</p>';

    const withNames = await Promise.all(poke.abilities.map(async a => ({
        name: await getFrenchAbilityName(a.url, a.name),
        isHidden: a.isHidden
    })));

    if (statsSelectedPoke1 !== poke.id) return;

    const itemsHtml = withNames.map(a => `
        <li>${a.name}${a.isHidden ? '<span class="move-meta">Talent caché</span>' : ''}</li>
    `).join('');

    abilitiesSectionDisplay.innerHTML = `
        <h3>Talents (${poke.frenchName})</h3>
        <ul class="moves-list">${itemsHtml}</ul>
    `;
}

// === Capacités : traduction française d'une capacité (avec cache) ===
async function getFrenchMoveName(moveUrl, moveNameEn) {
    if (moveNameTranslations[moveNameEn]) return moveNameTranslations[moveNameEn];

    const res = await fetch(moveUrl);
    const data = await res.json();
    const frEntry = data.names.find(n => n.language.name === 'fr');
    const frName = frEntry ? frEntry.name : moveNameEn;
    moveNameTranslations[moveNameEn] = frName;
    return frName;
}

// === Capacités : récupère et catégorise les capacités d'un Pokémon pour le jeu actif ===
async function getPokemonMovesForCurrentGame(poke) {
    const natural = [];
    const machine = [];

    poke.moves.forEach(moveEntry => {
        const detail = moveEntry.version_group_details.find(d => d.version_group.name === currentVersionGroupName);
        if (!detail) return;

        const methodName = detail.move_learn_method.name;

        if (methodName === 'level-up' || methodName === 'egg') {
            natural.push({
                moveUrl: moveEntry.move.url,
                moveNameEn: moveEntry.move.name,
                level: detail.level_learned_at,
                method: methodName
            });
        } else if (methodName === 'machine') {
            machine.push({ moveUrl: moveEntry.move.url, moveNameEn: moveEntry.move.name });
        }
    });

    natural.sort((a, b) => a.level - b.level);

    const naturalWithNames = await Promise.all(natural.map(async m => ({
        name: await getFrenchMoveName(m.moveUrl, m.moveNameEn),
        label: m.method === 'egg' ? 'Éclosion' : `Niveau ${m.level}`
    })));

    const machineWithNames = await Promise.all(machine.map(async m => ({
        name: await getFrenchMoveName(m.moveUrl, m.moveNameEn)
    })));
    machineWithNames.sort((a, b) => a.name.localeCompare(b.name));

    return { natural: naturalWithNames, machine: machineWithNames };
}

// === Capacités : affiche la section sous les stats pour le Pokémon sélectionné ===
async function renderMovesSection(poke) {
    movesSectionDisplay.innerHTML = '<p class="calc-intro">Chargement des capacités...</p>';

    const { natural, machine } = await getPokemonMovesForCurrentGame(poke);

    if (statsSelectedPoke1 !== poke.id) return;

    const naturalHtml = natural.length
        ? natural.map(m => `<li>${m.name}<span class="move-meta">${m.label}</span></li>`).join('')
        : '<li class="moves-empty">Aucune capacité naturelle trouvée pour ce jeu.</li>';

    const machineHtml = machine.length
        ? machine.map(m => `<li>${m.name}</li>`).join('')
        : '<li class="moves-empty">Aucune CT/CS trouvée pour ce jeu.</li>';

    movesSectionDisplay.innerHTML = `
        <h3>Capacités apprises (${poke.frenchName})</h3>
        <div class="moves-columns">
            <div class="moves-column">
                <h4>Naturellement (niveau / éclosion)</h4>
                <ul class="moves-list">${naturalHtml}</ul>
            </div>
            <div class="moves-column">
                <h4>Par CT / CS</h4>
                <ul class="moves-list">${machineHtml}</ul>
            </div>
        </div>
    `;
}

// === Spécificités : limite le nombre de requêtes en vol simultanément (navigateur) ===
async function mapWithConcurrencyBrowser(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index++;
            try {
                results[current] = await fn(items[current], current);
            } catch (e) {
                results[current] = null;
            }
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

// === Spécificités : récupère l'ensemble des versions où un Pokémon est rencontrable à l'état sauvage (avec cache) ===
async function getEncounterVersions(pokeName) {
    if (encounterVersionsCache[pokeName]) return encounterVersionsCache[pokeName];

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeName}/encounters`);
        const data = await res.json();
        const versions = new Set();
        data.forEach(loc => {
            loc.version_details.forEach(vd => versions.add(vd.version.name));
        });
        encounterVersionsCache[pokeName] = versions;
        return versions;
    } catch (e) {
        encounterVersionsCache[pokeName] = new Set();
        return encounterVersionsCache[pokeName];
    }
}

// === Spécificités : charge et affiche méga-évolutions, formes spéciales et exclusivités pour le jeu actif ===
async function loadSpecificities() {
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
        megaListDisplay.innerHTML = megas.length ? '' : '<p class="evolutions-empty">Pas de méga-évolution dans ce jeu.</p>';
        versionExclusivesDisplay.innerHTML = '<p class="calc-intro">Analyse des rencontres en cours (peut prendre un moment sur un grand Pokédex)...</p>';

        const results = await mapWithConcurrencyBrowser(allPokemon, 8, async (poke) => {
            const versions = await getEncounterVersions(poke.name);
            const inA = versions.has(versionA);
            const inB = versions.has(versionB);
            if (inA && !inB) return { poke, side: 'A' };
            if (inB && !inA) return { poke, side: 'B' };
            return null;
        });

        exclusives = {
            versionA,
            versionB,
            listA: results.filter(r => r && r.side === 'A').map(r => r.poke),
            listB: results.filter(r => r && r.side === 'B').map(r => r.poke)
        };
    }

    specificitiesCache[slug] = { megas, specialForms, exclusives };
    renderSpecificities(specificitiesCache[slug]);
}

// === Spécificités : construit une carte simple (image + nom) ===
function specificityCardHtml(poke, subLabel) {
    return `
        <div class="pokemon-card">
            <img src="${getArtworkUrl(poke)}" alt="${poke.frenchName}">
            <h3>${poke.frenchName}</h3>
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

    const labelA = formatLocationName(exclusives.versionA);
    const labelB = formatLocationName(exclusives.versionB);

    const listAHtml = exclusives.listA.length
        ? exclusives.listA.map(p => `<li>${p.frenchName}</li>`).join('')
        : '<li class="moves-empty">Aucun trouvé</li>';
    const listBHtml = exclusives.listB.length
        ? exclusives.listB.map(p => `<li>${p.frenchName}</li>`).join('')
        : '<li class="moves-empty">Aucun trouvé</li>';

    versionExclusivesDisplay.innerHTML = `
        <div class="moves-column">
            <h4>Exclusifs ${labelA}</h4>
            <ul class="moves-list">${listAHtml}</ul>
        </div>
        <div class="moves-column">
            <h4>Exclusifs ${labelB}</h4>
            <ul class="moves-list">${listBHtml}</ul>
        </div>
    `;
}

// === Initialisation ===
window.addEventListener('DOMContentLoaded', () => {
    updateGameCover(gameSelect.value);
    loadGame(gameSelect.value); // charge le jeu sélectionné par défaut (Rouge/Bleu)
    updateTeamDisplay();
    loadTypeChart();
}); 
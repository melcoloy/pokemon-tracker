// Règles propres à chaque génération (types, stats, talents, table des types)

// === Règles propres à chaque génération ===
// Les données (types des Pokémon, table des types) viennent de PokéAPI dans leur état ACTUEL.
// On les corrige ici pour les jeux plus anciens.

// Génération de chaque jeu (sert à choisir la bonne table des types et les bons types de Pokémon)
const GAME_GENERATION = {
    'red': 1, 'yellow': 1,
    'gold': 2, 'crystal': 2,
    'ruby': 3, 'emerald': 3, 'firered': 3,
    'diamond': 4, 'platinum': 4, 'heartgold': 4,
    'black': 5, 'black-2': 5,
    'x': 6, 'omega-ruby': 6,
    'sun': 7, 'ultra-sun': 7, 'lets-go-pikachu': 7,
    'sword': 8, 'brilliant-diamond': 8, 'legends-arceus': 8,
    'scarlet': 9
};

function getGameGeneration(versionSlug) {
    return GAME_GENERATION[versionSlug] || 9;
}

// Types qui n'existent pas encore dans une génération donnée
function typeExistsInGeneration(typeName, generation) {
    if (typeName === 'steel' || typeName === 'dark') return generation >= 2;
    if (typeName === 'fairy') return generation >= 6;
    if (typeName === 'stellar') return generation >= 9;
    return true;
}

// Anciens types des Pokémon modifiés par l'arrivée des types Acier (gén. 2) et Fée (gén. 6).
// "until" = dernière génération où l'ancien typage s'applique.
const PAST_POKEMON_TYPES = [
    { until: 1, names: ['magnemite', 'magneton'], types: ['electric'] },
    { until: 5, names: ['clefairy', 'clefable', 'cleffa', 'jigglypuff', 'wigglytuff', 'igglybuff', 'snubbull', 'granbull', 'togepi', 'azurill'], types: ['normal'] },
    { until: 5, names: ['togetic', 'togekiss'], types: ['normal', 'flying'] },
    { until: 5, names: ['mr-mime', 'mime-jr', 'ralts', 'kirlia', 'gardevoir'], types: ['psychic'] },
    { until: 5, names: ['marill', 'azumarill'], types: ['water'] },
    { until: 5, names: ['mawile'], types: ['steel'] },
    { until: 5, names: ['cottonee', 'whimsicott'], types: ['grass'] }
];

// Noms français de secours (au cas où la table des types n'est pas encore chargée)
const TYPE_NAMES_FR_FALLBACK = {
    normal: 'Normal', flying: 'Vol', psychic: 'Psy', water: 'Eau',
    grass: 'Plante', electric: 'Électrik', steel: 'Acier'
};

// === Remplace les types actuels par ceux de la génération du jeu (ex : Mélofée Normal dans Rouge) ===
function applyGenerationPokemonTypes(pokemonList, generation) {
    pokemonList.forEach(poke => {
        // Prend la règle la plus ancienne qui s'applique encore (ex : Magnéti en gén. 1)
        const rule = PAST_POKEMON_TYPES
            .filter(r => generation <= r.until && r.names.includes(poke.name))
            .sort((a, b) => a.until - b.until)[0];
        if (!rule) return;

        poke.types = rule.types.map(t => ({ type: { name: t } }));
        poke.frenchTypes = rule.types.map(t => typeTranslations[t] || TYPE_NAMES_FR_FALLBACK[t] || t);
    });
}

// === Anciennes stats et anciens talents (data/past.json, généré par export-csv-data.js) ===
let pastDataPromise = null;

function loadPastData() {
    if (!pastDataPromise) {
        pastDataPromise = fetch('data/past.json')
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null);
    }
    return pastDataPromise;
}

// Parmi des entrées { until, ... }, garde celle qui s'applique à la génération donnée :
// la plus ancienne "until" encore >= génération (ou undefined si la valeur actuelle s'applique)
function pickPastEntry(entries, generation) {
    return entries
        .filter(e => e.until >= generation)
        .sort((a, b) => a.until - b.until)[0];
}

function abilityApiUrl(abilityName) {
    return `https://pokeapi.co/api/v2/ability/${abilityName}/`;
}

// === Remplace stats et talents actuels par ceux de la génération du jeu ===
function applyGenerationStatsAndAbilities(pokemonList, generation, pastData) {
    const pastStatsByName = (pastData && pastData.stats) || {};
    const pastAbilitiesByName = (pastData && pastData.abilities) || {};

    pokemonList.forEach(poke => {
        // --- Stats ---
        if (Array.isArray(poke.stats)) {
            const pastStats = pastStatsByName[poke.name] || [];
            poke.stats = poke.stats.map(s => {
                const past = pickPastEntry(pastStats.filter(p => p.stat === s.stat.name), generation);
                return past ? { ...s, base_stat: past.value } : s;
            });

            // Gén. 1 : une seule stat "Spécial" à la place d'Attaque Spé. / Défense Spé.
            if (generation === 1) {
                const special = pickPastEntry(pastStats.filter(p => p.stat === 'special'), generation);
                const spAtk = poke.stats.find(s => s.stat.name === 'special-attack');
                const value = special ? special.value : (spAtk ? spAtk.base_stat : 0);
                poke.stats = poke.stats
                    .filter(s => s.stat.name !== 'special-attack' && s.stat.name !== 'special-defense')
                    .concat([{ base_stat: value, effort: 0, stat: { name: 'special' } }]);
            }
        }

        // --- Talents ---
        if (!Array.isArray(poke.abilities)) return; // ancien fichier local sans talents

        if (generation < 3) {
            poke.abilities = []; // les talents apparaissent en gén. 3
            return;
        }

        // Reconstitue les emplacements : talents normaux = 1 puis 2, talent caché = 3
        const slots = {};
        let normalSlot = 1;
        poke.abilities.forEach(a => {
            if (a.isHidden) slots[3] = a;
            else slots[normalSlot++] = a;
        });

        const pastAbilities = pastAbilitiesByName[poke.name] || [];
        [1, 2, 3].forEach(slot => {
            const past = pickPastEntry(pastAbilities.filter(p => p.slot === slot), generation);
            if (!past) return;
            if (past.name) slots[slot] = { name: past.name, url: abilityApiUrl(past.name), isHidden: past.isHidden };
            else delete slots[slot];
        });

        // Les talents cachés apparaissent en gén. 5
        if (generation < 5) delete slots[3];

        poke.abilities = [1, 2, 3].filter(slot => slots[slot]).map(slot => slots[slot]);
    });
}

// === Applique toutes les règles de génération (types, stats, talents) aux Pokémon d'un jeu ===
async function applyGenerationRules(pokemonList, versionSlug) {
    const generation = getGameGeneration(versionSlug);
    applyGenerationPokemonTypes(pokemonList, generation);
    applyGenerationStatsAndAbilities(pokemonList, generation, await loadPastData());
}

// === Fixe le multiplicateur d'un type d'attaque contre un type défenseur dans une table ===
function setTypeRelation(chart, atkType, defType, multiplier) {
    const rel = chart[atkType];
    if (!rel) return;
    rel.double_damage_to = rel.double_damage_to.filter(t => t !== defType);
    rel.half_damage_to = rel.half_damage_to.filter(t => t !== defType);
    rel.no_damage_to = rel.no_damage_to.filter(t => t !== defType);
    if (multiplier === 2) rel.double_damage_to.push(defType);
    else if (multiplier === 0.5) rel.half_damage_to.push(defType);
    else if (multiplier === 0) rel.no_damage_to.push(defType);
}

// === Construit la table des types valable pour une génération à partir de la table actuelle ===
function getTypeChartForGeneration(generation) {
    const chart = {};
    Object.entries(typeChart).forEach(([atkType, rel]) => {
        if (!typeExistsInGeneration(atkType, generation)) return;
        const keep = t => typeExistsInGeneration(t, generation);
        chart[atkType] = {
            double_damage_to: rel.double_damage_to.filter(keep),
            half_damage_to: rel.half_damage_to.filter(keep),
            no_damage_to: rel.no_damage_to.filter(keep)
        };
    });

    // Gén. 2 à 5 : l'Acier résistait aux types Spectre et Ténèbres
    if (generation >= 2 && generation <= 5) {
        setTypeRelation(chart, 'ghost', 'steel', 0.5);
        setTypeRelation(chart, 'dark', 'steel', 0.5);
    }

    // Gén. 1 : quelques relations différentes
    if (generation === 1) {
        setTypeRelation(chart, 'bug', 'poison', 2);
        setTypeRelation(chart, 'poison', 'bug', 2);
        setTypeRelation(chart, 'ghost', 'psychic', 0);
        setTypeRelation(chart, 'ice', 'fire', 1);
    }

    return chart;
}

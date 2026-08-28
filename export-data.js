// export-data.js
// Génère les fichiers data/{jeu}.json et data/types.json utilisés par l'app.
//
// Utilisation (depuis le terminal VSCode, à la racine du projet) :
//   node export-data.js                -> exporte TOUS les jeux
//   node export-data.js red yellow     -> exporte seulement les jeux listés
//
// Nécessite Node 18 ou plus récent (pour le fetch natif). Vérifie avec : node -v

const fs = require('fs');
const path = require('path');

const ALL_GAMES = [
    'red', 'yellow', 'firered', 'lets-go-pikachu',
    'gold', 'crystal', 'heartgold',
    'ruby', 'emerald', 'omega-ruby',
    'diamond', 'platinum', 'brilliant-diamond',
    'black', 'black-2',
    'x',
    'sun', 'ultra-sun',
    'sword',
    'legends-arceus',
    'scarlet'
];

const REGION_FORM_LABELS_FR = { alola: 'Alola', galar: 'Galar', hisui: 'Hisui', paldea: 'Paldea' };

const typeTranslations = {};
const typeChart = {};
const rawChainCache = new Map(); // url -> chaîne d'évolution brute, partagée entre tous les jeux pour éviter de refetch

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
    return res.json();
}

// Limite le nombre de requêtes en vol simultanément (pour ne pas surcharger l'API)
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index++;
            try {
                results[current] = await fn(items[current], current);
            } catch (e) {
                console.warn(`  ! Erreur sur l'élément ${current}:`, e.message);
                results[current] = null;
            }
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

function getFrenchNameFromSpecies(speciesData) {
    const fr = speciesData.names.find(n => n.language.name === 'fr');
    return fr ? fr.name : speciesData.name;
}

async function getFrenchType(typeUrl, typeName) {
    if (typeTranslations[typeName]) return typeTranslations[typeName];
    const data = await fetchJson(typeUrl);
    const fr = data.names.find(n => n.language.name === 'fr');
    typeTranslations[typeName] = fr ? fr.name : typeName;
    return typeTranslations[typeName];
}

async function getChain(url) {
    if (rawChainCache.has(url)) return rawChainCache.get(url);
    const data = await fetchJson(url);
    rawChainCache.set(url, data);
    return data;
}

async function isFinalStage(speciesData) {
    const chainData = await getChain(speciesData.evolution_chain.url);
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

const itemNamesFr = {
    'fire-stone': 'Pierre Feu', 'water-stone': 'Pierre Eau', 'thunder-stone': 'Pierre Foudre',
    'leaf-stone': 'Pierre Plante', 'moon-stone': 'Pierre Lune', 'sun-stone': 'Pierre Soleil',
    'shiny-stone': 'Pierre Éclat', 'dusk-stone': 'Pierre Nuit', 'dawn-stone': 'Pierre Aube',
    'ice-stone': 'Pierre Glace', 'kings-rock': 'Roche Royale', 'metal-coat': 'Armure Métal',
    'dragon-scale': 'Écaille Dragon', 'up-grade': 'Améliorator', 'protector': 'Protecteur',
    'electirizer': 'Électrisant', 'magmarizer': 'Magmatisant', 'oval-stone': 'Pierre Ovale',
    'razor-claw': 'Griffe Affûtée', 'razor-fang': 'Croc Affûté', 'prism-scale': 'Écaille Prisme'
};
function itemNameFr(slug) { return itemNamesFr[slug] || slug; }

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
        return details.held_item ? `Échange (en tenant ${itemNameFr(details.held_item.name)})` : 'Échange';
    }
    if (trigger === 'use-item') return `Utiliser : ${itemNameFr(details.item.name)}`;
    return trigger;
}

function pickVarietyForRegion(speciesData, regionName) {
    if (regionName) {
        const regional = speciesData.varieties.find(v => v.pokemon.name.endsWith(`-${regionName}`));
        if (regional) return { variety: regional, isRegionalForm: true };
    }
    const def = speciesData.varieties.find(v => v.is_default) || speciesData.varieties[0];
    return { variety: def, isRegionalForm: false };
}

async function getGameSpeciesInfo(versionSlug) {
    const versionData = await fetchJson(`https://pokeapi.co/api/v2/version/${versionSlug}`);
    const vgData = await fetchJson(versionData.version_group.url);

    const speciesSet = new Set();
    const orderMap = {};

    for (let dexIndex = 0; dexIndex < vgData.pokedexes.length; dexIndex++) {
        const dexData = await fetchJson(vgData.pokedexes[dexIndex].url);
        dexData.pokemon_entries.forEach(entry => {
            const name = entry.pokemon_species.name;
            speciesSet.add(name);
            if (!(name in orderMap)) orderMap[name] = [dexIndex, entry.entry_number];
        });
    }

    const regionName = vgData.regions.length > 0 ? vgData.regions[0].name : null;
    return { speciesNames: [...speciesSet], versionGroupName: vgData.name, regionName, orderMap };
}

async function exportGame(versionSlug) {
    console.log(`\n=== ${versionSlug} ===`);
    const outPath = path.join(DATA_DIR, `${versionSlug}.json`);
    if (fs.existsSync(outPath)) {
        console.log('  Déjà présent, ignoré (supprime le fichier pour le régénérer).');
        return;
    }

    const { speciesNames, versionGroupName, regionName, orderMap } = await getGameSpeciesInfo(versionSlug);
    console.log(`  ${speciesNames.length} espèces à charger...`);

    const usedChainUrls = new Set();

    const pokemonResults = await mapWithConcurrency(speciesNames, 10, async (name) => {
        const speciesData = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${name}`);
        usedChainUrls.add(speciesData.evolution_chain.url);

        const frenchNameBase = getFrenchNameFromSpecies(speciesData);
        const isFinal = await isFinalStage(speciesData);
        const isLegendary = speciesData.is_legendary || speciesData.is_mythical;

        const { variety, isRegionalForm } = pickVarietyForRegion(speciesData, regionName);
        const pokeData = await fetchJson(variety.pokemon.url);

        const frenchTypes = await Promise.all(pokeData.types.map(t => getFrenchType(t.type.url, t.type.name)));

        const frenchName = isRegionalForm
            ? `${frenchNameBase} (Forme de ${REGION_FORM_LABELS_FR[regionName] || regionName})`
            : frenchNameBase;

        // Ne garde que les capacités apprenables dans CE jeu (allège fortement le fichier)
        const trimmedMoves = pokeData.moves
            .map(m => {
                const detail = m.version_group_details.find(d => d.version_group.name === versionGroupName);
                if (!detail) return null;
                return {
                    move: { name: m.move.name, url: m.move.url },
                    version_group_details: [{
                        level_learned_at: detail.level_learned_at,
                        move_learn_method: { name: detail.move_learn_method.name },
                        version_group: { name: versionGroupName }
                    }]
                };
            })
            .filter(Boolean);

        const abilities = pokeData.abilities.map(a => ({
            name: a.ability.name,
            url: a.ability.url,
            isHidden: a.is_hidden
        }));

        return {
            id: speciesData.id,
            speciesName: name,
            name: pokeData.name,
            frenchName,
            types: pokeData.types.map(t => ({ type: { name: t.type.name } })),
            frenchTypes,
            stats: pokeData.stats,
            sprites: {
                front_default: pokeData.sprites.front_default,
                official_artwork: (pokeData.sprites.other && pokeData.sprites.other['official-artwork'])
                    ? pokeData.sprites.other['official-artwork'].front_default
                    : null
            },
            isFinal,
            isLegendary,
            abilities,
            moves: trimmedMoves
        };
    });

    const pokemon = pokemonResults.filter(Boolean).sort((a, b) => {
        const oa = orderMap[a.speciesName] || [Infinity, Infinity];
        const ob = orderMap[b.speciesName] || [Infinity, Infinity];
        if (oa[0] !== ob[0]) return oa[0] - ob[0];
        return oa[1] - ob[1];
    });

    // Construit evolutionMap à partir des chaînes utilisées par ce jeu uniquement
    const evolutionMap = {};
    usedChainUrls.forEach(url => {
        const chainData = rawChainCache.get(url);
        function walk(node) {
            if (node.evolves_to.length > 0) {
                evolutionMap[node.species.name] = node.evolves_to.map(child => ({
                    toName: child.species.name,
                    method: describeEvolutionMethod(child.evolution_details[0])
                }));
            }
            node.evolves_to.forEach(walk);
        }
        walk(chainData.chain);
    });

    const exportObj = { versionSlug, versionGroupName, regionName, pokemon, evolutionMap };
    fs.writeFileSync(outPath, JSON.stringify(exportObj));
    const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(1);
    console.log(`  ✅ ${pokemon.length} Pokémon exportés -> data/${versionSlug}.json (${sizeMb} Mo)`);
}

async function exportTypes() {
    const outPath = path.join(DATA_DIR, 'types.json');
    if (fs.existsSync(outPath)) {
        console.log('types.json déjà présent, ignoré.');
        return;
    }
    console.log('Export de la table des types...');
    const data = await fetchJson('https://pokeapi.co/api/v2/type?limit=20');
    const validTypes = data.results.filter(t => t.name !== 'unknown' && t.name !== 'shadow');
    const typeDataList = await mapWithConcurrency(validTypes, 10, t => fetchJson(t.url));

    typeDataList.forEach(t => {
        const fr = t.names.find(n => n.language.name === 'fr');
        typeTranslations[t.name] = fr ? fr.name : t.name;
        typeChart[t.name] = {
            double_damage_to: t.damage_relations.double_damage_to.map(d => d.name),
            half_damage_to: t.damage_relations.half_damage_to.map(d => d.name),
            no_damage_to: t.damage_relations.no_damage_to.map(d => d.name)
        };
    });

    fs.writeFileSync(outPath, JSON.stringify({ typeChart, typeTranslations }));
    console.log('✅ data/types.json généré.');
}

async function main() {
    const args = process.argv.slice(2);
    const games = args.length > 0 ? args : ALL_GAMES;

    console.log(`Export de ${games.length} jeu(x) : ${games.join(', ')}`);
    console.log('⚠️  Cela peut prendre plusieurs minutes (voire plus pour les jeux récents avec beaucoup de Pokémon).\n');

    await exportTypes();

    for (const slug of games) {
        try {
            await exportGame(slug);
        } catch (e) {
            console.error(`  ❌ Échec pour ${slug}:`, e.message);
        }
    }

    console.log('\nTerminé !');
}

main();
// export-csv-data.js
// Génère les données complémentaires de l'app à partir des CSV officiels de PokéAPI
// (dépôt GitHub PokeAPI/pokeapi), sans passer par l'API REST :
//
//   data/past.json          anciennes stats et anciens talents (pour les jeux plus anciens)
//   data/names.json         noms français : capacités, talents, objets, lieux, versions, espèces
//   data/extra/{jeu}.json   pour chaque jeu : capacités apprises (avec détails adaptés à la
//                           génération et numéros de CT), zones de rencontre, conditions d'évolution,
//                           numéros du Pokédex régional, descriptions des Pokémon et des capacités
//
// Les fichiers data/{jeu}.json (générés par export-data.js) doivent déjà exister :
// ce script y lit la liste des Pokémon de chaque jeu.
//
// Utilisation (à la racine du projet) :
//   node export-csv-data.js              -> tous les jeux présents dans data/
//   node export-csv-data.js red yellow   -> seulement les jeux listés
//
// Nécessite Node 18 ou plus récent (pour le fetch natif).

const fs = require('fs');
const path = require('path');

const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const DATA_DIR = path.join(__dirname, 'data');
const EXTRA_DIR = path.join(DATA_DIR, 'extra');
const FRENCH = '5'; // local_language_id du français dans PokéAPI

// Méthodes d'apprentissage gardées : clé courte utilisée dans les fichiers générés
const LEARN_METHODS = { 'level-up': 'level', 'egg': 'egg', 'machine': 'machine', 'tutor': 'tutor' };

// Avant la génération 4, la catégorie (physique / spéciale) dépend du type de la capacité
const PHYSICAL_TYPES_BEFORE_GEN4 = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel']);

// ---------------------------------------------------------------------------
// Lecture CSV
// ---------------------------------------------------------------------------

// Découpe un CSV en lignes de valeurs, en gérant les champs entre guillemets
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field); field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            rows.push(row); row = [];
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }

    const [header, ...lines] = rows.filter(r => r.length > 1 || r[0] !== '');
    return lines.map(values => {
        const obj = {};
        header.forEach((col, i) => { obj[col] = values[i] === undefined ? '' : values[i]; });
        return obj;
    });
}

async function fetchCsv(name) {
    const res = await fetch(`${CSV_BASE}/${name}.csv`);
    if (!res.ok) throw new Error(`HTTP ${res.status} pour ${name}.csv`);
    return parseCsv(await res.text());
}

// { id -> identifier }
function idMap(rows, key = 'identifier') {
    return Object.fromEntries(rows.map(r => [r.id, r[key]]));
}

// { identifier -> nom français } à partir d'une table *_names
function frenchNames(nameRows, idColumn, idToIdentifier) {
    const out = {};
    nameRows.forEach(r => {
        if (r.local_language_id !== FRENCH) return;
        const identifier = idToIdentifier[r[idColumn]];
        if (identifier && r.name) out[identifier] = r.name;
    });
    return out;
}

const num = v => (v === '' || v === undefined ? null : Number(v));

// ---------------------------------------------------------------------------
// Fichiers globaux
// ---------------------------------------------------------------------------

function buildPast(csv, ids) {
    // Chaque ligne "past" donne l'ancienne valeur et la DERNIÈRE génération où elle s'appliquait
    const stats = {};
    csv.pokemon_stats_past.forEach(r => {
        const name = ids.pokemon[r.pokemon_id];
        const stat = ids.stats[r.stat_id];
        if (!name || !stat) return;
        (stats[name] = stats[name] || []).push({ until: Number(r.generation_id), stat, value: Number(r.base_stat) });
    });

    // name = null : l'emplacement était vide (ex : pas encore de talent caché)
    const abilities = {};
    csv.pokemon_abilities_past.forEach(r => {
        const name = ids.pokemon[r.pokemon_id];
        if (!name) return;
        (abilities[name] = abilities[name] || []).push({
            until: Number(r.generation_id),
            slot: Number(r.slot),
            name: r.ability_id ? (ids.abilities[r.ability_id] || null) : null,
            isHidden: r.is_hidden === '1'
        });
    });

    return { stats, abilities };
}

function buildNames(csv, ids) {
    return {
        moves: frenchNames(csv.move_names, 'move_id', ids.moves),
        abilities: frenchNames(csv.ability_names, 'ability_id', ids.abilities),
        items: frenchNames(csv.item_names, 'item_id', ids.items),
        locations: frenchNames(csv.location_names, 'location_id', ids.locations),
        versions: frenchNames(csv.version_names, 'version_id', ids.versions),
        species: frenchNames(csv.pokemon_species_names, 'pokemon_species_id', ids.species)
    };
}

// ---------------------------------------------------------------------------
// Fichier par jeu
// ---------------------------------------------------------------------------

// Libellé français d'une machine : tm05 -> CT05, hm01 -> CS01, tr12 -> DT12
function machineLabel(itemIdentifier) {
    const m = /^(tm|hm|tr)(\d+)$/.exec(itemIdentifier || '');
    if (!m) return null;
    const prefix = { tm: 'CT', hm: 'CS', tr: 'DT' }[m[1]];
    return `${prefix}${m[2].padStart(2, '0')}`;
}

// Détails d'une capacité tels qu'ils étaient dans le groupe de versions donné
function moveDetailsForVersionGroup(moveRow, vg, csv, ids, changelogByMove) {
    let typeId = moveRow.type_id;
    let power = moveRow.power;
    let accuracy = moveRow.accuracy;
    let pp = moveRow.pp;

    // move_changelog : valeurs AVANT le groupe de versions "changed_in". Pour chaque champ, on prend
    // le premier changement survenu après le jeu ; un champ vide = ce champ n'a pas changé à ce moment-là.
    const changes = (changelogByMove[moveRow.id] || [])
        .filter(c => c.order > vg.order)
        .sort((a, b) => a.order - b.order);
    const firstValue = (field, current) => {
        const change = changes.find(c => c.row[field] !== '');
        return change ? change.row[field] : current;
    };
    typeId = firstValue('type_id', typeId);
    power = firstValue('power', power);
    accuracy = firstValue('accuracy', accuracy);
    pp = firstValue('pp', pp);

    const type = ids.types[typeId] || null;
    let damageClass = ids.damageClasses[moveRow.damage_class_id] || null;
    if (vg.generation < 4 && damageClass && damageClass !== 'status') {
        damageClass = PHYSICAL_TYPES_BEFORE_GEN4.has(type) ? 'physical' : 'special';
    }

    // Format compact : [type, catégorie, puissance, précision, PP]
    return [type, damageClass, num(power), num(accuracy), num(pp)];
}

// Condition d'évolution au format compact (seuls les champs utiles sont gardés)
function compactEvolutionRow(r, ids) {
    const d = { trigger: ids.evolutionTriggers[r.evolution_trigger_id] || 'unknown' };
    const set = (key, value) => { if (value !== null && value !== undefined && value !== '') d[key] = value; };

    set('item', ids.items[r.trigger_item_id]);
    set('level', num(r.minimum_level));
    set('gender', ids.genders[r.gender_id]);
    set('location', ids.locations[r.location_id]);
    set('heldItem', ids.items[r.held_item_id]);
    set('time', r.time_of_day);
    set('knownMove', ids.moves[r.known_move_id]);
    set('knownMoveType', ids.types[r.known_move_type_id]);
    set('happiness', num(r.minimum_happiness));
    set('beauty', num(r.minimum_beauty));
    set('affection', num(r.minimum_affection));
    set('relativeStats', num(r.relative_physical_stats));
    set('partySpecies', ids.species[r.party_species_id]);
    set('partyType', ids.types[r.party_type_id]);
    set('tradeSpecies', ids.species[r.trade_species_id]);
    if (r.needs_overworld_rain === '1') d.rain = true;
    if (r.turn_upside_down === '1') d.upsideDown = true;
    if (r.needs_multiplayer === '1') d.multiplayer = true;
    set('usedMove', ids.moves[r.used_move_id]);
    set('moveCount', num(r.minimum_move_count));
    set('steps', num(r.minimum_steps));
    set('damageTaken', num(r.minimum_damage_taken));
    return d;
}

function buildGameExtra(game, csv, ids, lookups) {
    const vg = lookups.versionGroupsByName[game.versionGroupName];
    if (!vg) throw new Error(`Groupe de versions inconnu : ${game.versionGroupName}`);

    const pokemonNames = new Set(game.pokemon.map(p => p.name));
    const speciesNames = new Set(game.pokemon.map(p => p.speciesName));
    const gameRegionIds = lookups.regionsByVersionGroup[vg.id] || new Set();

    // --- Capacités apprises ---
    const machineByMove = {};
    csv.machines.forEach(m => {
        if (m.version_group_id !== vg.id) return;
        const label = machineLabel(ids.items[m.item_id]);
        if (label) machineByMove[ids.moves[m.move_id]] = label;
    });

    const learnsets = {};
    const usedMoves = new Set();
    csv.pokemon_moves.forEach(r => {
        if (r.version_group_id !== vg.id) return;
        const pokeName = ids.pokemon[r.pokemon_id];
        if (!pokemonNames.has(pokeName)) return;
        const method = LEARN_METHODS[ids.learnMethods[r.pokemon_move_method_id]];
        if (!method) return;
        const move = ids.moves[r.move_id];
        if (!move) return;

        const set = learnsets[pokeName] = learnsets[pokeName] || {};
        const list = set[method] = set[method] || [];
        if (method === 'level') {
            const level = Number(r.level) || 0;
            if (!list.some(([l, m]) => l === level && m === move)) list.push([level, move]);
        } else if (!list.includes(move)) {
            list.push(move);
        }
        usedMoves.add(move);
    });
    Object.values(learnsets).forEach(set => {
        if (set.level) set.level.sort((a, b) => a[0] - b[0]);
    });

    const moves = {};
    usedMoves.forEach(move => {
        const row = lookups.movesByIdentifier[move];
        if (row) moves[move] = moveDetailsForVersionGroup(row, vg, csv, ids, lookups.changelogByMove);
    });
    const machines = {};
    usedMoves.forEach(move => { if (machineByMove[move]) machines[move] = machineByMove[move]; });

    // --- Zones de rencontre (par version du jeu) ---
    const versionIds = new Set(game.versionNames.map(v => lookups.versionIdsByName[v]).filter(Boolean));
    const locationMap = {}; // nom du lieu -> { version -> Set(pokémon) }
    csv.encounters.forEach(e => {
        if (!versionIds.has(e.version_id)) return;
        const locationId = lookups.locationIdByArea[e.location_area_id];
        const location = ids.locations[locationId];
        const pokeName = ids.pokemon[e.pokemon_id];
        const version = ids.versions[e.version_id];
        if (!location || !pokeName) return;
        const byVersion = locationMap[location] = locationMap[location] || {};
        (byVersion[version] = byVersion[version] || new Set()).add(pokeName);
    });
    const locations = Object.entries(locationMap).map(([name, byVersion]) => ({
        name,
        versions: Object.fromEntries(Object.entries(byVersion).map(([v, set]) => [v, [...set].sort()]))
    }));

    // --- Conditions d'évolution valables pour ce jeu ---
    // Une ligne s'applique à partir de son groupe de versions. Les évolutions liées à un lieu
    // ne sont gardées que si ce lieu est dans la région du jeu.
    const evolutions = {};
    const rowsBySpecies = {};
    csv.pokemon_evolution.forEach(r => {
        const species = ids.species[r.evolved_species_id];
        if (!speciesNames.has(species)) return;
        (rowsBySpecies[species] = rowsBySpecies[species] || []).push(r);
    });
    Object.entries(rowsBySpecies).forEach(([species, rows]) => {
        const sinceThisGame = rows.filter(r => {
            const rowVg = lookups.versionGroupsById[r.version_group_id];
            return !rowVg || rowVg.order <= vg.order;
        });
        const candidates = sinceThisGame.length ? sinceThisGame : rows;
        const inRegion = candidates.filter(r => {
            if (!r.location_id) return true;
            return gameRegionIds.has(lookups.regionIdByLocation[r.location_id]);
        });
        const kept = inRegion.length ? inRegion : candidates;

        const seen = new Set();
        evolutions[species] = kept.map(r => compactEvolutionRow(r, ids)).filter(d => {
            const key = JSON.stringify(d);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });

    // --- Numéros du Pokédex régional (premier Pokédex du jeu qui contient l'espèce) ---
    const dexIds = csv.pokedex_version_groups.filter(r => r.version_group_id === vg.id).map(r => r.pokedex_id);
    const dexNames = dexIds.map(id => lookups.pokedexNamesFr[id] || ids.pokedexes[id]);
    const dexNumbers = {};
    dexIds.forEach((dexId, dexIndex) => {
        (lookups.dexNumbersByPokedex[dexId] || []).forEach(([speciesId, number]) => {
            const species = ids.species[speciesId];
            if (speciesNames.has(species) && !(species in dexNumbers)) dexNumbers[species] = [dexIndex, number];
        });
    });

    // --- Descriptions en français ---
    // PokéAPI n'a des textes français qu'à partir de Noir/Blanc : pour un jeu plus ancien (ou sans texte),
    // on prend le texte français le plus proche, en indiquant de quel jeu il vient.
    const versionOrder = v => (lookups.versionGroupsById[ids.versionGroupOfVersion[v]] || {}).order || 0;
    const pickText = (entries, isSameGame, orderOf) => {
        if (!entries || entries.length === 0) return null;
        const own = entries.find(isSameGame);
        if (own) return { text: own.text };
        const after = entries.filter(e => orderOf(e) >= vg.order).sort((a, b) => orderOf(a) - orderOf(b));
        const before = entries.filter(e => orderOf(e) < vg.order).sort((a, b) => orderOf(b) - orderOf(a));
        return (after[0] || before[0]) || null;
    };

    const descriptions = {};
    speciesNames.forEach(species => {
        const entries = lookups.speciesFlavorFr[species];
        const picked = pickText(entries, e => versionIds.has(e.versionId), e => versionOrder(e.versionId));
        if (!picked) return;
        descriptions[species] = picked.versionId && !versionIds.has(picked.versionId)
            ? [picked.text, ids.versions[picked.versionId]]
            : [picked.text];
    });

    const moveDescriptions = {};
    usedMoves.forEach(move => {
        const entries = lookups.moveFlavorFr[move];
        const picked = pickText(entries, e => e.versionGroupId === vg.id, e => (lookups.versionGroupsById[e.versionGroupId] || {}).order || 0);
        if (picked) moveDescriptions[move] = picked.text;
    });

    return { learnsets, moves, machines, locations, evolutions, dexNames, dexNumbers, descriptions, moveDescriptions };
}

// Nettoie un texte de description (retours à la ligne et sauts de page des jeux)
function cleanFlavorText(text) {
    return text.replace(/[\f\n\r\u00ad]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

const CSV_FILES = [
    'pokemon', 'pokemon_species', 'pokemon_species_names', 'stats', 'abilities', 'ability_names',
    'pokemon_stats_past', 'pokemon_abilities_past',
    'moves', 'move_names', 'move_changelog', 'move_damage_classes', 'types', 'machines', 'items', 'item_names',
    'pokemon_moves', 'pokemon_move_methods',
    'versions', 'version_names', 'version_groups', 'version_group_regions',
    'encounters', 'location_areas', 'locations', 'location_names',
    'pokemon_evolution', 'evolution_triggers', 'genders',
    'pokemon_dex_numbers', 'pokedexes', 'pokedex_version_groups', 'pokedex_prose',
    'pokemon_species_flavor_text', 'move_flavor_text'
];

async function main() {
    const requested = process.argv.slice(2);
    const games = (requested.length ? requested : fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json') && !['types.json', 'past.json', 'names.json'].includes(f))
        .map(f => f.replace(/\.json$/, '')));

    console.log(`Téléchargement de ${CSV_FILES.length} fichiers CSV PokéAPI...`);
    const csv = {};
    await Promise.all(CSV_FILES.map(async name => { csv[name] = await fetchCsv(name); }));

    const ids = {
        pokemon: idMap(csv.pokemon),
        species: idMap(csv.pokemon_species),
        stats: idMap(csv.stats),
        abilities: idMap(csv.abilities),
        moves: idMap(csv.moves),
        types: idMap(csv.types),
        damageClasses: idMap(csv.move_damage_classes),
        items: idMap(csv.items),
        learnMethods: idMap(csv.pokemon_move_methods),
        versions: idMap(csv.versions),
        locations: idMap(csv.locations),
        evolutionTriggers: idMap(csv.evolution_triggers),
        genders: idMap(csv.genders),
        pokedexes: idMap(csv.pokedexes),
        versionGroupOfVersion: idMap(csv.versions, 'version_group_id')
    };

    const versionGroupsById = {};
    const versionGroupsByName = {};
    csv.version_groups.forEach(r => {
        const vg = { id: r.id, name: r.identifier, generation: Number(r.generation_id), order: Number(r.order) };
        versionGroupsById[r.id] = vg;
        versionGroupsByName[r.identifier] = vg;
    });

    const regionsByVersionGroup = {};
    csv.version_group_regions.forEach(r => {
        (regionsByVersionGroup[r.version_group_id] = regionsByVersionGroup[r.version_group_id] || new Set()).add(r.region_id);
    });

    const changelogByMove = {};
    csv.move_changelog.forEach(r => {
        const vg = versionGroupsById[r.changed_in_version_group_id];
        if (!vg) return;
        (changelogByMove[r.move_id] = changelogByMove[r.move_id] || []).push({ order: vg.order, row: r });
    });

    const lookups = {
        versionGroupsById,
        versionGroupsByName,
        regionsByVersionGroup,
        changelogByMove,
        movesByIdentifier: Object.fromEntries(csv.moves.map(r => [r.identifier, r])),
        versionIdsByName: Object.fromEntries(csv.versions.map(r => [r.identifier, r.id])),
        locationIdByArea: Object.fromEntries(csv.location_areas.map(r => [r.id, r.location_id])),
        regionIdByLocation: Object.fromEntries(csv.locations.map(r => [r.id, r.region_id])),
        pokedexNamesFr: Object.fromEntries(csv.pokedex_prose.filter(r => r.local_language_id === FRENCH).map(r => [r.pokedex_id, r.name])),
        dexNumbersByPokedex: {},
        speciesFlavorFr: {},
        moveFlavorFr: {}
    };
    csv.pokemon_dex_numbers.forEach(r => {
        (lookups.dexNumbersByPokedex[r.pokedex_id] = lookups.dexNumbersByPokedex[r.pokedex_id] || [])
            .push([r.species_id, Number(r.pokedex_number)]);
    });
    csv.pokemon_species_flavor_text.forEach(r => {
        if (r.language_id !== FRENCH) return;
        const species = ids.species[r.species_id];
        (lookups.speciesFlavorFr[species] = lookups.speciesFlavorFr[species] || [])
            .push({ versionId: r.version_id, text: cleanFlavorText(r.flavor_text) });
    });
    csv.move_flavor_text.forEach(r => {
        if (r.language_id !== FRENCH) return;
        const move = ids.moves[r.move_id];
        (lookups.moveFlavorFr[move] = lookups.moveFlavorFr[move] || [])
            .push({ versionGroupId: r.version_group_id, text: cleanFlavorText(r.flavor_text) });
    });

    fs.writeFileSync(path.join(DATA_DIR, 'past.json'), JSON.stringify(buildPast(csv, ids)));
    console.log('OK : data/past.json');
    fs.writeFileSync(path.join(DATA_DIR, 'names.json'), JSON.stringify(buildNames(csv, ids)));
    console.log('OK : data/names.json');

    if (!fs.existsSync(EXTRA_DIR)) fs.mkdirSync(EXTRA_DIR);
    for (const slug of games) {
        const gamePath = path.join(DATA_DIR, `${slug}.json`);
        if (!fs.existsSync(gamePath)) {
            console.warn(`  ! data/${slug}.json absent : lance d'abord "node export-data.js ${slug}"`);
            continue;
        }
        const game = JSON.parse(fs.readFileSync(gamePath, 'utf8'));
        const extra = buildGameExtra(game, csv, ids, lookups);
        fs.writeFileSync(path.join(EXTRA_DIR, `${slug}.json`), JSON.stringify(extra));
        console.log(`OK : data/extra/${slug}.json (${Object.keys(extra.learnsets).length} Pokémon, ${extra.locations.length} zones)`);
    }
}

main().catch(e => {
    console.error('Erreur :', e.message);
    process.exit(1);
});

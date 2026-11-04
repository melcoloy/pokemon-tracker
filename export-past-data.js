// export-past-data.js
// Génère data/past.json : les anciennes statistiques et anciens talents des Pokémon,
// pour afficher les bonnes valeurs dans les jeux des générations précédentes.
//
// Source : les fichiers CSV officiels de PokéAPI (dépôt GitHub PokeAPI/pokeapi).
// Chaque ligne "past" donne l'ancienne valeur et la DERNIÈRE génération où elle s'appliquait.
//
// Utilisation (à la racine du projet) :
//   node export-past-data.js
//
// Nécessite Node 18 ou plus récent (pour le fetch natif).

const fs = require('fs');
const path = require('path');

const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const OUT_PATH = path.join(__dirname, 'data', 'past.json');

async function fetchCsv(name) {
    const res = await fetch(`${CSV_BASE}/${name}.csv`);
    if (!res.ok) throw new Error(`HTTP ${res.status} pour ${name}.csv`);
    const text = await res.text();
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const columns = header.split(',');
    // Ces fichiers ne contiennent pas de virgules dans les valeurs : un split simple suffit
    return lines.map(line => {
        const values = line.split(',');
        const row = {};
        columns.forEach((col, i) => { row[col] = values[i] === undefined ? '' : values[i]; });
        return row;
    });
}

async function main() {
    console.log('Téléchargement des CSV PokéAPI...');
    const [pokemonRows, statRows, abilityRows, pastStatRows, pastAbilityRows] = await Promise.all([
        fetchCsv('pokemon'),
        fetchCsv('stats'),
        fetchCsv('abilities'),
        fetchCsv('pokemon_stats_past'),
        fetchCsv('pokemon_abilities_past')
    ]);

    const pokemonName = Object.fromEntries(pokemonRows.map(r => [r.id, r.identifier]));
    const statName = Object.fromEntries(statRows.map(r => [r.id, r.identifier]));
    const abilityName = Object.fromEntries(abilityRows.map(r => [r.id, r.identifier]));

    // { "pikachu": [{ until: 1, stat: "special", value: 50 }, ...] }
    const stats = {};
    pastStatRows.forEach(r => {
        const name = pokemonName[r.pokemon_id];
        const stat = statName[r.stat_id];
        if (!name || !stat) return;
        (stats[name] = stats[name] || []).push({
            until: Number(r.generation_id),
            stat,
            value: Number(r.base_stat)
        });
    });

    // { "gengar": [{ until: 6, slot: 1, name: "levitate", isHidden: false }, ...] }
    // name = null : l'emplacement était vide (ex : pas encore de talent caché)
    const abilities = {};
    pastAbilityRows.forEach(r => {
        const name = pokemonName[r.pokemon_id];
        if (!name) return;
        (abilities[name] = abilities[name] || []).push({
            until: Number(r.generation_id),
            slot: Number(r.slot),
            name: r.ability_id ? (abilityName[r.ability_id] || null) : null,
            isHidden: r.is_hidden === '1'
        });
    });

    fs.writeFileSync(OUT_PATH, JSON.stringify({ stats, abilities }));
    console.log(`OK : ${OUT_PATH}`);
    console.log(`  ${Object.keys(stats).length} Pokémon avec d'anciennes stats`);
    console.log(`  ${Object.keys(abilities).length} Pokémon avec d'anciens talents`);
}

main().catch(e => {
    console.error('Erreur :', e.message);
    process.exit(1);
});

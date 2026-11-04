// Filtre par zone

// === Construit la liste des zones d'une région qui contiennent au moins un Pokémon pour le jeu donné ===
async function buildLocationsWithPokemon(regionName, versionSlug) {
    const cacheKey = `${regionName}::${versionSlug}`;
    if (locationsCache[cacheKey]) return locationsCache[cacheKey];

    const regionRes = await fetch(`https://pokeapi.co/api/v2/region/${regionName}`);
    if (!regionRes.ok) throw new Error(`HTTP ${regionRes.status} pour la région ${regionName}`);
    const regionData = await regionRes.json();

    // Nombre limité de zones chargées en parallèle (une région compte des centaines de zones :
    // tout lancer d'un coup surcharge PokéAPI et le navigateur)
    const locationResults = await mapWithConcurrencyBrowser(regionData.locations, 6, async (loc) => {
        try {
            const locRes = await fetch(loc.url);
            if (!locRes.ok) return null;
            const locData = await locRes.json();

            const speciesSet = new Set();

            // Les sous-zones d'une zone sont chargées une par une
            for (const area of locData.areas) {
                const areaRes = await fetch(area.url);
                if (!areaRes.ok) continue;
                const areaData = await areaRes.json();
                areaData.pokemon_encounters.forEach(enc => {
                    const availableHere = enc.version_details.some(vd => vd.version.name === versionSlug);
                    if (availableHere) speciesSet.add(enc.pokemon.name);
                });
            }

            if (speciesSet.size === 0) return null;

            locationPokemonCache[`${loc.name}::${versionSlug}`] = speciesSet;

            const frEntry = locData.names.find(n => n.language.name === 'fr');
            const label = frEntry ? frEntry.name : formatLocationName(loc.name);

            return { name: loc.name, label };
        } catch (e) {
            console.warn(`Impossible de charger la zone ${loc.name}`, e);
            return null;
        }
    });

    const locations = locationResults.filter(Boolean).sort((a, b) => a.label.localeCompare(b.label));
    locationsCache[cacheKey] = locations;
    return locations;
}

// === Zones du jeu actif depuis data/extra/{jeu}.json (instantané, hors ligne) ===
// Un Pokémon compte pour une zone s'il y est rencontrable dans au moins une des versions du jeu.
function buildLocationsFromExtra(versionSlug) {
    return gameExtra.locations
        .map(loc => {
            const pokemon = new Set(Object.values(loc.versions).flat());
            locationPokemonCache[`${loc.name}::${versionSlug}`] = pokemon;
            return { name: loc.name, label: frNames.locations[loc.name] || formatLocationName(loc.name) };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

// === Remplit le menu déroulant des zones (avec Pokémon uniquement) pour le jeu actif ===
// Données locales si elles existent, sinon PokéAPI en direct (plus lent).
async function populateLocationFilter(regionName, versionSlug) {
    let locations;

    if (gameExtra && Array.isArray(gameExtra.locations)) {
        locations = buildLocationsFromExtra(versionSlug);
    } else if (regionName) {
        locationLoadingIndicator.textContent = 'Préparation des zones...';
        locationFilter.disabled = true;
        try {
            locations = await buildLocationsWithPokemon(regionName, versionSlug);
        } catch (error) {
            console.error('Erreur lors du chargement des zones:', error);
            locations = [];
        }
        locationLoadingIndicator.textContent = '';
        if (currentRegionName !== regionName || gameSelect.value !== versionSlug) return;
    } else {
        locations = [];
    }

    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        option.textContent = loc.label;
        locationFilter.appendChild(option);
    });

    // Certains jeux récents n'ont pas de données de rencontre dans PokéAPI
    locationFilter.disabled = locations.length === 0;
    locationFilter.title = locations.length === 0 ? 'Pas de données de zones pour ce jeu' : '';
    if (locations.length === 0) {
        locationFilter.options[0].textContent = 'Zones indisponibles pour ce jeu';
    }
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

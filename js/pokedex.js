// Onglet Pokédex : liste du jeu, numéros régionaux, suivi « vu / capturé » (Pokédex vivant)

// === Images : artwork officiel HD (sinon sprite), en version chromatique si l'option est active ===
let shinyMode = readStorageJson('shiny', false) === true;

// Les images chromatiques de PokéAPI sont dans un sous-dossier "shiny" à côté des normales
function toShinyUrl(url) {
    if (!url) return url;
    return url
        .replace('/official-artwork/', '/official-artwork/shiny/')
        .replace(/\/sprites\/pokemon\/(\d+\.png)$/, '/sprites/pokemon/shiny/$1');
}

function withShiny(url) {
    return shinyMode ? toShinyUrl(url) : url;
}

function getArtworkUrl(poke) {
    if (!poke.sprites) return '';
    let url = poke.sprites.official_artwork
        || (poke.sprites.other && poke.sprites.other['official-artwork'] && poke.sprites.other['official-artwork'].front_default)
        || poke.sprites.front_default
        || '';
    return withShiny(url);
}

// Les entrées de l'équipe gardent l'URL de l'image normale : on la convertit à l'affichage
function teamImageUrl(teamMon) {
    return withShiny((teamMon.image || '').replace('/official-artwork/shiny/', '/official-artwork/').replace('/sprites/pokemon/shiny/', '/sprites/pokemon/'));
}

function updateShinyButton() {
    shinyToggleBtn.textContent = shinyMode ? '✨ Chromatiques : oui' : '✨ Chromatiques : non';
    shinyToggleBtn.setAttribute('aria-pressed', String(shinyMode));
}

shinyToggleBtn.addEventListener('click', () => {
    shinyMode = !shinyMode;
    writeStorage('shiny', shinyMode);
    updateShinyButton();
    // Redessine tout ce qui affiche des images
    applyFilters();
    updateTeamDisplay();
    if (currentGeneratedTeam.length) displayGeneratedTeam(currentGeneratedTeam);
    performEvolutionSearch();
    if (specificitiesCache[gameSelect.value]) renderSpecificities(specificitiesCache[gameSelect.value]);
});

updateShinyButton();

// === Numéro du Pokédex régional du jeu (ex : "Kanto #025"), sinon null ===
function getRegionalDexLabel(poke) {
    const entry = gameExtra && gameExtra.dexNumbers && gameExtra.dexNumbers[poke.speciesName];
    if (!entry) return null;
    const [dexIndex, number] = entry;
    const names = gameExtra.dexNames || [];
    const dexName = names.length > 1 ? `${names[dexIndex]} ` : '';
    return `${dexName}#${String(number).padStart(3, '0')}`;
}

// === Pokédex vivant : statut de chaque Pokémon, par jeu ===
// localStorage "dexProgress" = { slug du jeu -> { nom du Pokémon -> "seen" | "caught" } }
let dexProgress = readStorageJson('dexProgress', {});
if (!dexProgress || typeof dexProgress !== 'object' || Array.isArray(dexProgress)) dexProgress = {};

const DEX_STATUS_LABELS = {
    none: { icon: '○', text: 'Pas vu' },
    seen: { icon: '👁', text: 'Vu' },
    caught: { icon: '●', text: 'Capturé' }
};
const DEX_STATUS_NEXT = { none: 'seen', seen: 'caught', caught: 'none' };

function gameDexProgress() {
    const slug = gameSelect.value;
    if (!dexProgress[slug]) dexProgress[slug] = {};
    return dexProgress[slug];
}

function getDexStatus(poke) {
    return gameDexProgress()[poke.name] || 'none';
}

function setDexStatus(poke, status) {
    const progress = gameDexProgress();
    if (status === 'none') delete progress[poke.name];
    else progress[poke.name] = status;
    writeStorage('dexProgress', dexProgress);
}

function dexStatusButtonHtml(poke) {
    const status = getDexStatus(poke);
    const { icon, text } = DEX_STATUS_LABELS[status];
    const next = DEX_STATUS_LABELS[DEX_STATUS_NEXT[status]].text.toLowerCase();
    return `<button type="button" class="dex-status dex-${status}" data-name="${escapeHtml(poke.name)}"
        aria-label="${escapeHtml(`${poke.frenchName} : ${text.toLowerCase()}. Marquer comme ${next}`)}">${icon} ${text}</button>`;
}

// === Barre de progression du Pokédex vivant ===
function updateDexProgressDisplay() {
    const total = allPokemon.length;
    const progress = gameDexProgress();
    const names = new Set(allPokemon.map(p => p.name));
    const caught = Object.entries(progress).filter(([n, s]) => s === 'caught' && names.has(n)).length;
    const seen = Object.entries(progress).filter(([n, s]) => s === 'seen' && names.has(n)).length;
    const percent = total ? Math.round((caught / total) * 100) : 0;

    dexProgressBar.max = total || 1;
    dexProgressBar.value = caught;
    dexProgressText.textContent = total
        ? `${caught} / ${total} capturés (${percent} %) · ${seen + caught} vus`
        : '';
}

// === Affichage des Pokémon ===
function displayPokemon(pokemonList) {
    updateDexProgressDisplay();

    if (pokemonList.length === 0) {
        pokedexCount.textContent = 'Aucun Pokémon trouvé';
        pokedexList.innerHTML = '<p>Aucun Pokémon trouvé</p>';
        return;
    }

    pokedexCount.textContent = `${pokemonList.length} Pokémon affiché${pokemonList.length > 1 ? 's' : ''}`;
    pokedexList.innerHTML = pokemonList.map(poke => {
        const nationalLabel = `Nat. #${poke.id.toString().padStart(3, '0')}`;
        const regionalLabel = getRegionalDexLabel(poke);

        return `
            <div class="pokemon-card dex-card-${getDexStatus(poke)}">
                <button type="button" class="card-main" data-id="${poke.id}" aria-label="${escapeHtml(`${poke.frenchName}, ${poke.frenchTypes.join(' / ')} : voir les statistiques`)}">
                    <img src="${escapeHtml(getArtworkUrl(poke))}" alt="" loading="lazy">
                    <h3>${escapeHtml(poke.frenchName)}</h3>
                    <p>${regionalLabel ? `<span class="regional-num">${escapeHtml(regionalLabel)}</span> ` : ''}<span class="national-num">(${nationalLabel})</span></p>
                    <p class="types">${escapeHtml(poke.frenchTypes.join(', '))}</p>
                </button>
                ${dexStatusButtonHtml(poke)}
            </div>
        `;
    }).join('');
}

pokedexList.addEventListener('click', (e) => {
    const statusBtn = e.target.closest('.dex-status[data-name]');
    if (statusBtn) {
        const poke = allPokemon.find(p => p.name === statusBtn.dataset.name);
        if (!poke) return;
        setDexStatus(poke, DEX_STATUS_NEXT[getDexStatus(poke)]);
        // Met à jour la carte sans redessiner la liste (le focus clavier reste sur le bouton),
        // sauf si le filtre par statut la ferait disparaître
        if (dexStatusFilter.value) {
            applyFilters();
            return;
        }
        const card = statusBtn.closest('.pokemon-card');
        card.className = `pokemon-card dex-card-${getDexStatus(poke)}`;
        const fresh = document.createElement('div');
        fresh.innerHTML = dexStatusButtonHtml(poke);
        const newBtn = fresh.firstElementChild;
        statusBtn.replaceWith(newBtn);
        newBtn.focus();
        updateDexProgressDisplay();
        return;
    }

    const card = e.target.closest('.card-main[data-id]');
    if (card) selectPokemonInStats(Number(card.dataset.id));
});

// === Clic sur une carte du Pokédex : redirige vers Statistiques et Capacités avec ce Pokémon sélectionné ===
function selectPokemonInStats(id) {
    const poke = allPokemon.find(p => p.id === id);
    if (!poke) return;

    switchToTab('stats');

    statsSelectedPoke1 = id;
    statsPoke1Input.value = poke.frenchName;
    closeAutocomplete(statsPoke1Input, statsPoke1Results);
    updateStatsChart();
}

// === Filtrage combiné (recherche + type + zone + statut) ===
function applyFilters() {
    const query = normalizeSearch(searchInput.value);
    const selectedType = typeFilter.value;
    const selectedStatus = dexStatusFilter.value;

    const filtered = allPokemon.filter(poke => {
        const regional = getRegionalDexLabel(poke) || '';
        const matchesSearch = normalizeSearch(poke.frenchName).includes(query)
            || poke.id.toString().includes(query)
            || (query && /^\d+$/.test(query) && regional.endsWith(`#${query.padStart(3, '0')}`));
        const matchesType = !selectedType || poke.types.some(t => t.type.name === selectedType);
        const matchesLocation = !currentLocationSpeciesNames || currentLocationSpeciesNames.has(poke.name);
        const status = getDexStatus(poke);
        const matchesStatus = !selectedStatus
            || (selectedStatus === 'not-caught' && status !== 'caught')
            || selectedStatus === status;
        return matchesSearch && matchesType && matchesLocation && matchesStatus;
    });

    displayPokemon(filtered);
}

searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
dexStatusFilter.addEventListener('change', applyFilters);

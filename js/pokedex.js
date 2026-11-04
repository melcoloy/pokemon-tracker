// Onglet Pokédex

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
        pokedexCount.textContent = 'Aucun Pokémon trouvé';
        pokedexList.innerHTML = '<p>Aucun Pokémon trouvé</p>';
        return;
    }

    pokedexCount.textContent = `${pokemonList.length} Pokémon affiché${pokemonList.length > 1 ? 's' : ''}`;
    pokedexList.innerHTML = pokemonList.map(poke => {
        const nationalLabel = `Nat. #${poke.id.toString().padStart(3, '0')}`;

        return `
            <div class="pokemon-card" data-id="${poke.id}" role="button" tabindex="0" aria-label="${escapeHtml(`${poke.frenchName}, ${poke.frenchTypes.join(' / ')} : voir les statistiques`)}">
                <img src="${escapeHtml(getArtworkUrl(poke))}" alt="${escapeHtml(poke.frenchName)}" loading="lazy">
                <h3>${escapeHtml(poke.frenchName)}</h3>
                <p><span class="national-num">(${nationalLabel})</span></p>
                <p class="types">${escapeHtml(poke.frenchTypes.join(', '))}</p>
            </div>
        `;
    }).join('');
}

pokedexList.addEventListener('click', (e) => {
    const card = e.target.closest('.pokemon-card[data-id]');
    if (card) selectPokemonInStats(Number(card.dataset.id));
});
activateOnKeyboard(pokedexList, '.pokemon-card[data-id]');

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

// === Filtrage combiné (recherche + type + zone) ===
function applyFilters() {
    const query = normalizeSearch(searchInput.value);
    const selectedType = typeFilter.value;

    const filtered = allPokemon.filter(poke => {
        const matchesSearch = normalizeSearch(poke.frenchName).includes(query) || poke.id.toString().includes(query);
        const matchesType = !selectedType || poke.types.some(t => t.type.name === selectedType);
        const matchesLocation = !currentLocationSpeciesNames || currentLocationSpeciesNames.has(poke.name);
        return matchesSearch && matchesType && matchesLocation;
    });

    displayPokemon(filtered);
}

searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);

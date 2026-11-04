// Onglet Statistiques et Capacités

// === Statistiques et Capacités : radar chart ===
const statNamesFr = {
    hp: 'PV',
    attack: 'Attaque',
    defense: 'Défense',
    'special-attack': 'Attaque Spé.',
    'special-defense': 'Défense Spé.',
    speed: 'Vitesse',
    special: 'Spécial'
};

// Gén. 1 : 5 stats (une seule stat Spécial) ; ensuite : 6 stats
function getStatOrder() {
    return currentGeneration === 1
        ? ['hp', 'attack', 'defense', 'special', 'speed']
        : ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
}

function getStatValues(poke) {
    return getStatOrder().map(statName => {
        const found = poke.stats.find(s => s.stat.name === statName);
        return found ? found.base_stat : 0;
    });
}

// === Recherche à suggestions (combobox accessible : flèches haut / bas, Entrée, Échap) ===
function closeAutocomplete(input, resultsEl) {
    resultsEl.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
}

function renderStatsAutocomplete(input, resultsEl, onSelect) {
    const query = input.value;
    if (!query.trim()) {
        closeAutocomplete(input, resultsEl);
        return;
    }

    input.setAttribute('aria-expanded', 'true');

    if (allPokemon.length === 0) {
        resultsEl.innerHTML = '<div class="autocomplete-item no-result" role="option" aria-disabled="true">Chargement...</div>';
        return;
    }

    const q = normalizeSearch(query);
    const matches = allPokemon
        .filter(p => normalizeSearch(p.frenchName).includes(q) || p.id.toString() === q)
        .slice(0, 8);

    if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="autocomplete-item no-result" role="option" aria-disabled="true">Aucun résultat</div>';
        return;
    }

    resultsEl.innerHTML = matches.map((p, i) => `
        <div class="autocomplete-item" role="option" id="${resultsEl.id}-opt-${i}" aria-selected="false" data-id="${p.id}">#${p.id.toString().padStart(3, '0')} ${escapeHtml(p.frenchName)}</div>
    `).join('');

    resultsEl.querySelectorAll('.autocomplete-item[data-id]').forEach(item => {
        item.addEventListener('click', () => {
            onSelect(parseInt(item.dataset.id));
            closeAutocomplete(input, resultsEl);
        });
    });
}

function setupStatsAutocomplete(input, resultsEl, onClear, onSelect) {
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', resultsEl.id);
    resultsEl.setAttribute('role', 'listbox');

    input.addEventListener('input', () => {
        if (!input.value.trim()) onClear();
        renderStatsAutocomplete(input, resultsEl, onSelect);
    });

    input.addEventListener('keydown', (e) => {
        const items = [...resultsEl.querySelectorAll('.autocomplete-item[data-id]')];
        if (e.key === 'Escape') {
            closeAutocomplete(input, resultsEl);
            return;
        }
        if (items.length === 0) return;

        let index = items.findIndex(i => i.classList.contains('active'));
        if (e.key === 'ArrowDown') index = index < items.length - 1 ? index + 1 : 0;
        else if (e.key === 'ArrowUp') index = index > 0 ? index - 1 : items.length - 1;
        else if (e.key === 'Enter') {
            e.preventDefault();
            (items[index] || items[0]).click();
            return;
        } else return;

        e.preventDefault();
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
            item.setAttribute('aria-selected', String(i === index));
        });
        input.setAttribute('aria-activedescendant', items[index].id);
        items[index].scrollIntoView({ block: 'nearest' });
    });
}

setupStatsAutocomplete(statsPoke1Input, statsPoke1Results,
    () => { statsSelectedPoke1 = null; updateStatsChart(); },
    (id) => {
        statsSelectedPoke1 = id;
        statsPoke1Input.value = allPokemon.find(x => x.id === id).frenchName;
        updateStatsChart();
    });

setupStatsAutocomplete(statsPoke2Input, statsPoke2Results,
    () => { statsSelectedPoke2 = null; updateStatsChart(); },
    (id) => {
        statsSelectedPoke2 = id;
        statsPoke2Input.value = allPokemon.find(x => x.id === id).frenchName;
        updateStatsChart();
    });

document.addEventListener('click', (e) => {
    if (!statsPoke1Input.contains(e.target) && !statsPoke1Results.contains(e.target)) {
        closeAutocomplete(statsPoke1Input, statsPoke1Results);
    }
    if (!statsPoke2Input.contains(e.target) && !statsPoke2Results.contains(e.target)) {
        closeAutocomplete(statsPoke2Input, statsPoke2Results);
    }
});

statsAddTeamBtn.addEventListener('click', () => {
    if (!statsSelectedPoke1) return;
    const poke = allPokemon.find(p => p.id === statsSelectedPoke1);
    if (!poke) return;
    addToTeam(poke);
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

    const statOrder = getStatOrder();
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

    // Couleurs du radar selon le thème (le canvas ne lit pas le CSS)
    const chartColors = isDarkMode()
        ? { text: '#e6e6f0', muted: '#a0a0b8', grid: 'rgba(255, 255, 255, 0.15)' }
        : { text: '#333333', muted: '#666666', grid: 'rgba(0, 0, 0, 0.1)' };

    statsRadarCanvas.setAttribute('aria-label', `Radar des statistiques de base : ${datasets.map(d => `${d.label} (${d.data.join(', ')})`).join(' ; ')}. Les valeurs sont aussi dans le tableau ci-dessous.`);

    // Chart.js vient d'un CDN : sans connexion, il peut manquer. On saute alors le radar,
    // le tableau des stats juste en dessous donne les mêmes valeurs.
    const chartAvailable = typeof Chart !== 'undefined';
    statsRadarCanvas.parentElement.hidden = !chartAvailable;

    if (chartAvailable) statsChartInstance = new Chart(statsRadarCanvas, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: chartColors.text } }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    suggestedMax: 150,
                    angleLines: { color: chartColors.grid },
                    grid: { color: chartColors.grid },
                    pointLabels: { color: chartColors.text, font: { size: 13 } },
                    ticks: { color: chartColors.muted, backdropColor: 'transparent' }
                }
            }
        }
    });

    let rowsHtml = `<table class="stats-data-table"><thead><tr><th>Statistique</th><th>${escapeHtml(poke1.frenchName)}</th>${poke2 ? `<th>${escapeHtml(poke2.frenchName)}</th>` : ''}</tr></thead><tbody>`;
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
    if (frNames.abilities[abilityNameEn]) return frNames.abilities[abilityNameEn];
    if (abilityNameTranslations[abilityNameEn]) return abilityNameTranslations[abilityNameEn];

    try {
        const res = await fetch(abilityUrl);
        if (!res.ok) return abilityNameEn;
        const data = await res.json();
        const frEntry = data.names.find(n => n.language.name === 'fr');
        const frName = frEntry ? frEntry.name : abilityNameEn;
        abilityNameTranslations[abilityNameEn] = frName;
        return frName;
    } catch (e) {
        // API injoignable : on affiche le nom anglais plutôt que de bloquer la section
        return abilityNameEn;
    }
}

// === Talents : affiche la section sous les stats pour le Pokémon sélectionné ===
async function renderAbilitiesSection(poke) {
    if (currentGeneration < 3) {
        abilitiesSectionDisplay.innerHTML = `
            <h3>Talents</h3>
            <p class="evolutions-empty">Les talents n'existent pas encore dans ce jeu (ils apparaissent en 3e génération, avec Rubis / Saphir).</p>
        `;
        return;
    }

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
        <li>${escapeHtml(a.name)}${a.isHidden ? '<span class="move-meta">Talent caché</span>' : ''}</li>
    `).join('');

    abilitiesSectionDisplay.innerHTML = `
        <h3>Talents (${escapeHtml(poke.frenchName)})</h3>
        <ul class="moves-list">${itemsHtml}</ul>
    `;
}

// === Capacités : libellés français ===
const DAMAGE_CLASS_FR = { physical: 'Physique', special: 'Spéciale', status: 'Statut' };

// Sections affichées, dans cet ordre
const LEARN_SECTIONS = [
    { key: 'level', title: 'Par montée de niveau', firstColumn: 'Niv.' },
    { key: 'machine', title: 'Par CT / CS', firstColumn: 'CT' },
    { key: 'egg', title: 'Par reproduction (capacités œuf)', firstColumn: null },
    { key: 'tutor', title: 'Par donneur de capacités', firstColumn: null }
];

// === Capacités : une ligne du tableau (nom, type, catégorie, puissance, précision, PP) ===
function moveRowHtml(moveSlug, firstCell) {
    const details = (gameExtra.moves && gameExtra.moves[moveSlug]) || [];
    const [type, damageClass, power, accuracy, pp] = details;
    const dash = '<span class="muted">—</span>';
    return `
        <tr>
            ${firstCell !== undefined ? `<td class="move-first">${escapeHtml(firstCell)}</td>` : ''}
            <td>${escapeHtml(moveNameFr(moveSlug))}</td>
            <td>${type ? `<span class="type-badge type-${escapeHtml(type)}">${escapeHtml(typeNameFr(type))}</span>` : dash}</td>
            <td>${damageClass ? escapeHtml(DAMAGE_CLASS_FR[damageClass] || damageClass) : dash}</td>
            <td class="num">${power ?? dash}</td>
            <td class="num">${accuracy ?? dash}</td>
            <td class="num">${pp ?? dash}</td>
        </tr>
    `;
}

// === Capacités : tableau d'une section (niveau, CT, œuf, donneur) ===
function moveTableHtml(section, learnset) {
    const entries = learnset[section.key] || [];
    if (entries.length === 0) return '';

    let rows;
    if (section.key === 'level') {
        rows = entries.map(([level, move]) => moveRowHtml(move, level === 0 ? 'Évol.' : String(level)));
    } else if (section.key === 'machine') {
        const machines = gameExtra.machines || {};
        // Ordre : CT, puis DT, puis CS, chacune par numéro
        const rank = label => {
            const m = /^(CT|DT|CS)(\d+)$/.exec(label || '');
            return m ? ['CT', 'DT', 'CS'].indexOf(m[1]) * 10000 + Number(m[2]) : Infinity;
        };
        rows = [...entries]
            .sort((a, b) => rank(machines[a]) - rank(machines[b]))
            .map(move => moveRowHtml(move, machines[move] || '?'));
    } else {
        rows = [...entries]
            .sort((a, b) => moveNameFr(a).localeCompare(moveNameFr(b)))
            .map(move => moveRowHtml(move));
    }

    return `
        <div class="moves-table-block">
            <h4>${section.title} <span class="muted">(${entries.length})</span></h4>
            <div class="table-scroll">
                <table class="moves-table">
                    <thead>
                        <tr>
                            ${section.firstColumn ? `<th scope="col">${section.firstColumn}</th>` : ''}
                            <th scope="col">Capacité</th>
                            <th scope="col">Type</th>
                            <th scope="col">Catégorie</th>
                            <th scope="col" class="num">Puiss.</th>
                            <th scope="col" class="num">Préc.</th>
                            <th scope="col" class="num">PP</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        </div>
    `;
}

// === Capacités : affiche la section sous les stats pour le Pokémon sélectionné ===
function renderMovesSection(poke) {
    const learnset = gameExtra && gameExtra.learnsets && gameExtra.learnsets[poke.name];

    if (!learnset) {
        movesSectionDisplay.innerHTML = `
            <h3>Capacités apprises (${escapeHtml(poke.frenchName)})</h3>
            <p class="evolutions-empty">Capacités indisponibles pour ce Pokémon dans ce jeu. Si le fichier data/extra/${escapeHtml(gameSelect.value)}.json manque, lance « node export-csv-data.js ».</p>
        `;
        return;
    }

    const note = currentGeneration < 4
        ? '<p class="calc-intro">Avant la 4e génération, la catégorie (physique / spéciale) dépend du type de la capacité.</p>'
        : '';

    movesSectionDisplay.innerHTML = `
        <h3>Capacités apprises (${escapeHtml(poke.frenchName)})</h3>
        ${note}
        ${LEARN_SECTIONS.map(section => moveTableHtml(section, learnset)).join('')}
    `;
}

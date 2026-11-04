// Onglet Calculatrice

// === Calculatrice de combat : chargement de la table des types (fichier local si dispo, sinon API) ===
async function loadTypeChart() {
    const fileData = await tryLoadJson('data/types.json');

    if (fileData) {
        Object.assign(typeChart, fileData.typeChart);
        Object.assign(typeTranslations, fileData.typeTranslations);
        refreshCalculatorForGame();
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

        refreshCalculatorForGame();
    } catch (error) {
        console.error('Erreur lors du chargement de la table des types:', error);
    }
}

// === Calculatrice : (re)construit la table et les menus pour la génération du jeu actif ===
// Appelée quand la table des types est chargée ET à chaque changement de jeu (l'ordre d'arrivée n'importe pas).
function refreshCalculatorForGame() {
    if (Object.keys(typeChart).length === 0) return;

    const generation = getGameGeneration(gameSelect.value);
    currentTypeChart = getTypeChartForGeneration(generation);

    const sorted = Object.keys(currentTypeChart)
        .map(name => ({ name, fr: typeTranslations[name] || name }))
        .sort((a, b) => a.fr.localeCompare(b.fr));

    [
        [atkTypeSelect, '-- Choisir --'],
        [defType1Select, '-- Choisir --'],
        [defType2Select, 'Aucun']
    ].forEach(([select, placeholder]) => {
        const previous = select.value;
        select.innerHTML = '';
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = placeholder;
        select.appendChild(empty);

        sorted.forEach(({ name, fr }) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = fr;
            select.appendChild(opt);
        });

        // Garde la sélection précédente si ce type existe encore dans cette génération
        select.value = currentTypeChart[previous] ? previous : '';
    });

    calcGenNote.textContent = `Table des types de la génération ${generation}.`;
    renderTeamAnalysis();
    populateCalcPokemonList();
    renderTypeChartTable();
    renderDefenderSummary();
    calcResult.textContent = '';
    calcResult.className = 'calc-result';
}

// === Calculatrice de combat : calcul du multiplicateur ===
function getMultiplier(atkType, defType) {
    const relations = currentTypeChart[atkType];
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
    if (defType2 && defType2 !== defType1) {
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

// === Défenseur choisi par son nom : remplit ses types (ceux de la génération du jeu) ===
function populateCalcPokemonList() {
    calcPokemonList.innerHTML = allPokemon
        .map(p => `<option value="${escapeHtml(p.frenchName)}"></option>`)
        .join('');
    calcPokemonInput.value = '';
}

function findPokemonByFrenchName(name) {
    const q = normalizeSearch(name);
    return q ? allPokemon.find(p => normalizeSearch(p.frenchName) === q) : null;
}

calcPokemonInput.addEventListener('input', () => {
    const poke = findPokemonByFrenchName(calcPokemonInput.value);
    if (!poke) return;
    const [type1, type2] = poke.types.map(t => t.type.name);
    defType1Select.value = type1 || '';
    defType2Select.value = type2 || '';
    renderDefenderSummary(poke);
    if (atkTypeSelect.value) calculateEffectiveness();
});

// Choisir des types à la main "oublie" le Pokémon choisi
[defType1Select, defType2Select].forEach(select => select.addEventListener('change', () => {
    calcPokemonInput.value = '';
    renderDefenderSummary();
}));

// === Résumé : tous les types d'attaque contre le défenseur choisi, regroupés par efficacité ===
function renderDefenderSummary(poke) {
    const defTypes = [defType1Select.value, defType2Select.value].filter((t, i, arr) => t && arr.indexOf(t) === i);
    if (defTypes.length === 0 || Object.keys(currentTypeChart).length === 0) {
        calcDefenderSummary.innerHTML = '';
        return;
    }

    const groups = [
        { test: m => m >= 4, label: 'Très efficace (×4)' },
        { test: m => m >= 2 && m < 4, label: 'Super efficace (×2)' },
        { test: m => m === 1, label: 'Efficacité normale (×1)' },
        { test: m => m === 0.5, label: 'Pas très efficace (×½)' },
        { test: m => m > 0 && m < 0.5, label: 'Très peu efficace (×¼)' },
        { test: m => m === 0, label: 'Aucun effet (×0)' }
    ];
    const atkTypes = getAnalysisTypes();
    const rows = groups.map(g => {
        const matching = atkTypes.filter(atk => g.test(getDefensiveMultiplier(atk, defTypes, null)));
        return matching.length
            ? `<div class="defender-group"><span class="defender-group-label">${g.label}</span>${typeBadgeList(matching, '')}</div>`
            : '';
    }).join('');

    const title = poke
        ? `Contre ${escapeHtml(poke.frenchName)} (${escapeHtml(defTypes.map(typeNameFr).join(' / '))})`
        : `Contre un Pokémon ${escapeHtml(defTypes.map(typeNameFr).join(' / '))}`;
    calcDefenderSummary.innerHTML = `
        <h3>${title}</h3>
        ${rows}
        ${poke ? '<p class="calc-intro">Calcul sur les types seulement : le talent (Lévitation…) n\'est pas pris en compte ici, mais il l\'est dans l\'analyse de l\'équipe.</p>' : ''}
    `;
}

// === Table des types complète de la génération (attaque en ligne, défense en colonne) ===
function renderTypeChartTable() {
    const types = getAnalysisTypes();
    const short = t => typeNameFr(t).slice(0, 4);
    typeChartTable.innerHTML = `
        <table class="analysis-table type-chart-table">
            <caption class="visually-hidden">Multiplicateur de chaque type d'attaque (lignes) contre chaque type de défenseur (colonnes)</caption>
            <thead>
                <tr>
                    <th scope="col">Attaque ↓ / Défense →</th>
                    ${types.map(t => `<th scope="col" title="${escapeHtml(typeNameFr(t))}"><span class="type-badge type-${escapeHtml(t)}">${escapeHtml(short(t))}</span></th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${types.map(atk => `
                    <tr>
                        <th scope="row">${typeBadgeHtml(atk)}</th>
                        ${types.map(def => {
                            const m = getMultiplier(atk, def);
                            const cls = m > 1 ? 'eff-good' : m === 0 ? 'mult-immune' : m < 1 ? 'eff-bad' : 'mult-neutral';
                            return `<td class="mult ${cls}" title="${escapeHtml(`${typeNameFr(atk)} contre ${typeNameFr(def)}`)}">${formatMultiplier(m)}</td>`;
                        }).join('')}
                    </tr>`).join('')}
            </tbody>
        </table>
        <p class="calc-intro analysis-legend">Vert : super efficace (×2) · rouge : pas très efficace (×½) · ×0 : aucun effet · case vide : normal.</p>
    `;
}

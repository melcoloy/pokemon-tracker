// Analyse de l'équipe (onglet Mon Équipe) : faiblesses, résistances et couverture offensive,
// calculées avec la table des types de la génération du jeu actif.

// Types d'attaque / de défense pris en compte (Stellaire ne sert qu'à la Téracristallisation)
function getAnalysisTypes() {
    return Object.keys(currentTypeChart)
        .filter(t => t !== 'stellar')
        .sort((a, b) => typeNameFr(a).localeCompare(typeNameFr(b)));
}

// Multiplicateur d'une attaque contre un Pokémon (produit sur ses 1 ou 2 types)
function getDefensiveMultiplier(atkType, defTypes) {
    return defTypes.reduce((m, defType) => m * getMultiplier(atkType, defType), 1);
}

function formatMultiplier(m) {
    if (m === 0) return '×0';
    if (m === 0.25) return '×¼';
    if (m === 0.5) return '×½';
    if (m === 1) return '';
    return `×${m}`;
}

function multiplierClass(m) {
    if (m === 0) return 'mult-immune';
    if (m < 1) return 'mult-resist';
    if (m >= 4) return 'mult-weak4';
    if (m > 1) return 'mult-weak';
    return 'mult-neutral';
}

function typeBadgeHtml(type) {
    return `<span class="type-badge type-${escapeHtml(type)}">${escapeHtml(typeNameFr(type))}</span>`;
}

function typeBadgeList(types, emptyText) {
    return types.length
        ? `<div class="analysis-badges">${types.map(typeBadgeHtml).join(' ')}</div>`
        : `<p class="evolutions-empty">${emptyText}</p>`;
}

// === Calcule toutes les données de l'analyse pour une liste de Pokémon du jeu actif ===
function computeTeamAnalysis(members) {
    const types = getAnalysisTypes();

    // Défense : pour chaque type d'attaque, multiplicateur subi par chaque membre
    const defense = types.map(atkType => {
        const multipliers = members.map(m => getDefensiveMultiplier(atkType, m.types));
        return {
            atkType,
            multipliers,
            weak: multipliers.filter(x => x > 1).length,
            resist: multipliers.filter(x => x < 1).length
        };
    });

    // Points faibles : au moins 2 membres faibles et plus de faibles que de résistants,
    // ou un type contre lequel personne ne résiste alors qu'au moins un membre y est faible
    const threats = defense
        .filter(d => (d.weak >= 2 && d.weak > d.resist) || (d.weak >= 1 && d.resist === 0 && members.length >= 3))
        .sort((a, b) => (b.weak - b.resist) - (a.weak - a.resist) || b.weak - a.weak);

    // Couverture offensive avec les types des Pokémon eux-mêmes (bonus STAB)
    const attackTypes = [...new Set(members.flatMap(m => m.types))];
    const covered = types.filter(defType => attackTypes.some(atk => getMultiplier(atk, defType) > 1));
    const notCovered = types.filter(defType => !covered.includes(defType));

    // Types de Pokémon qui compléteraient l'équipe : ceux qui résistent au plus de points faibles
    const threatTypes = threats.map(t => t.atkType);
    const suggestions = threatTypes.length === 0 ? [] : types
        .map(type => ({
            type,
            score: threatTypes.filter(atk => getMultiplier(atk, type) < 1).length,
            newWeaknesses: threatTypes.filter(atk => getMultiplier(atk, type) > 1).length
        }))
        .filter(s => s.score > 0 && s.newWeaknesses === 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

    return { types, defense, threats, covered, notCovered, suggestions };
}

// === Affiche l'analyse sous l'équipe ===
function renderTeamAnalysis() {
    if (allPokemon.length === 0 || Object.keys(currentTypeChart).length === 0) {
        teamAnalysisDisplay.innerHTML = '';
        return;
    }

    const members = userTeam.map(findTeamMonInGame).filter(Boolean)
        .map(poke => ({ name: poke.frenchName, types: poke.types.map(t => t.type.name) }));

    if (members.length === 0) {
        teamAnalysisDisplay.innerHTML = `
            <h3>Analyse de l'équipe</h3>
            <p class="evolutions-empty">Ajoute des Pokémon à ton équipe pour voir ses faiblesses, ses résistances et sa couverture offensive.</p>
        `;
        return;
    }

    const { defense, threats, covered, notCovered, suggestions, types } = computeTeamAnalysis(members);

    const threatItems = threats.map(t => `
        <li>${typeBadgeHtml(t.atkType)}
            <span>${t.weak} faible${t.weak > 1 ? 's' : ''}, ${t.resist === 0 ? 'aucun résistant' : `${t.resist} résistant${t.resist > 1 ? 's' : ''}`}</span>
        </li>`).join('');

    const suggestionItems = suggestions.map(s => `
        <li>${typeBadgeHtml(s.type)}
            <span>résiste à ${s.score} de ces types</span>
        </li>`).join('');

    const headerCells = members.map(m => `<th scope="col">${escapeHtml(m.name)}</th>`).join('');
    const rows = defense.map(d => `
        <tr>
            <th scope="row">${typeBadgeHtml(d.atkType)}</th>
            ${d.multipliers.map(m => `<td class="mult ${multiplierClass(m)}">${formatMultiplier(m)}</td>`).join('')}
            <td class="num ${d.weak >= 3 ? 'count-alert' : ''}">${d.weak || ''}</td>
            <td class="num">${d.resist || ''}</td>
        </tr>`).join('');

    const ignoredCount = userTeam.length - members.length;
    const ignoredNote = ignoredCount > 0
        ? `<p class="calc-intro">${ignoredCount} membre${ignoredCount > 1 ? 's' : ''} de l'équipe ne ${ignoredCount > 1 ? 'sont' : 'est'} pas dans ce jeu et ${ignoredCount > 1 ? 'sont ignorés' : 'est ignoré'}.</p>`
        : '';

    teamAnalysisDisplay.innerHTML = `
        <h3>Analyse de l'équipe</h3>
        <p class="calc-intro">Table des types de la génération ${currentGeneration}. Les talents (Lévitation, Absorb Eau…) et les objets ne sont pas pris en compte.</p>
        ${ignoredNote}

        <div class="analysis-cards">
            <section class="analysis-card">
                <h4>⚠️ Points faibles</h4>
                ${threats.length
                    ? `<ul class="analysis-list">${threatItems}</ul>`
                    : '<p class="evolutions-empty">Aucune faiblesse partagée : l\'équipe est bien équilibrée défensivement.</p>'}
            </section>

            <section class="analysis-card">
                <h4>🛡️ Pour les compenser</h4>
                ${suggestions.length
                    ? `<p class="analysis-hint">Types de Pokémon qui résistent à ces points faibles sans en ajouter :</p><ul class="analysis-list">${suggestionItems}</ul>`
                    : `<p class="evolutions-empty">${threats.length ? 'Aucun type simple ne couvre ces faiblesses sans en ajouter.' : 'Rien à compenser.'}</p>`}
            </section>

            <section class="analysis-card">
                <h4>🎯 Couverture offensive</h4>
                <p class="analysis-hint">Avec les types de tes Pokémon (bonus STAB), tu touches en super efficace ${covered.length} type${covered.length > 1 ? 's' : ''} sur ${types.length}.</p>
                <p class="analysis-subtitle">Non couverts :</p>
                ${typeBadgeList(notCovered, 'Aucun : tous les types sont couverts !')}
            </section>
        </div>

        <h4 class="analysis-table-title">Dégâts subis par type d'attaque</h4>
        <div class="table-scroll">
            <table class="analysis-table">
                <caption class="visually-hidden">Multiplicateur de dégâts subi par chaque membre de l'équipe selon le type de l'attaque</caption>
                <thead>
                    <tr>
                        <th scope="col">Attaque</th>
                        ${headerCells}
                        <th scope="col" class="num">Faibles</th>
                        <th scope="col" class="num">Résistants</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p class="calc-intro analysis-legend">×4 / ×2 : faible · ×½ / ×¼ : résiste · ×0 : immunisé · case vide : dégâts normaux.</p>
    `;
}

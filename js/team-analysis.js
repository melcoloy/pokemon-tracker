// Analyse de l'équipe (onglet Mon Équipe) : faiblesses, résistances et couverture offensive,
// calculées avec la table des types de la génération du jeu actif.

// Types d'attaque / de défense pris en compte (Stellaire ne sert qu'à la Téracristallisation)
function getAnalysisTypes() {
    return Object.keys(currentTypeChart)
        .filter(t => t !== 'stellar')
        .sort((a, b) => typeNameFr(a).localeCompare(typeNameFr(b)));
}

// Talents qui modifient les dégâts subis selon le type de l'attaque.
// (type d'attaque, multiplicateur des types, génération) -> nouveau multiplicateur
const ABILITY_DEFENSE_EFFECTS = {
    'levitate': (t, m) => (t === 'ground' ? 0 : m),
    'earth-eater': (t, m) => (t === 'ground' ? 0 : m),
    'flash-fire': (t, m) => (t === 'fire' ? 0 : m),
    'well-baked-body': (t, m) => (t === 'fire' ? 0 : m),
    'water-absorb': (t, m) => (t === 'water' ? 0 : m),
    'dry-skin': (t, m) => (t === 'water' ? 0 : t === 'fire' ? m * 1.25 : m),
    'storm-drain': (t, m, gen) => (t === 'water' && gen >= 5 ? 0 : m),
    'volt-absorb': (t, m) => (t === 'electric' ? 0 : m),
    'motor-drive': (t, m) => (t === 'electric' ? 0 : m),
    'lightning-rod': (t, m, gen) => (t === 'electric' && gen >= 5 ? 0 : m),
    'sap-sipper': (t, m) => (t === 'grass' ? 0 : m),
    'thick-fat': (t, m) => (t === 'fire' || t === 'ice' ? m * 0.5 : m),
    'heatproof': (t, m) => (t === 'fire' ? m * 0.5 : m),
    'water-bubble': (t, m) => (t === 'fire' ? m * 0.5 : m),
    'purifying-salt': (t, m) => (t === 'ghost' ? m * 0.5 : m),
    'fluffy': (t, m) => (t === 'fire' ? m * 2 : m),
    'filter': (t, m) => (m > 1 ? m * 0.75 : m),
    'solid-rock': (t, m) => (m > 1 ? m * 0.75 : m),
    'prism-armor': (t, m) => (m > 1 ? m * 0.75 : m),
    'wonder-guard': (t, m) => (m > 1 ? m : 0)
};

// Multiplicateur d'une attaque contre un Pokémon : produit sur ses 1 ou 2 types, puis talent
function getDefensiveMultiplier(atkType, defTypes, ability) {
    const base = defTypes.reduce((m, defType) => m * getMultiplier(atkType, defType), 1);
    const effect = ability && ABILITY_DEFENSE_EFFECTS[ability];
    return effect ? effect(atkType, base, currentGeneration) : base;
}

function formatMultiplier(m) {
    if (m === 0) return '×0';
    if (m === 0.25) return '×¼';
    if (m === 0.5) return '×½';
    if (m === 1) return '';
    return `×${String(Number(m.toFixed(3))).replace('.', ',')}`;
}

// Capacités qui infligent des dégâts fixes ou dont le type varie : sans intérêt pour la couverture
const MOVES_IGNORED_FOR_COVERAGE = new Set([
    'seismic-toss', 'night-shade', 'dragon-rage', 'sonic-boom', 'super-fang', 'psywave', 'endeavor',
    'final-gambit', 'counter', 'mirror-coat', 'metal-burst', 'bide', 'ruination', 'natures-madness',
    'guardian-of-alola', 'fissure', 'guillotine', 'horn-drill', 'sheer-cold', 'hidden-power'
]);

// Types d'attaque d'un membre : ceux de ses capacités offensives choisies, sinon ses propres types (STAB)
function getMemberAttackTypes(member) {
    const movesData = (gameExtra && gameExtra.moves) || {};
    const damagingTypes = member.moves
        .filter(move => !MOVES_IGNORED_FOR_COVERAGE.has(move))
        .map(move => movesData[move])
        .filter(details => details && details[0] && details[1] && details[1] !== 'status')
        .map(details => details[0]);
    return damagingTypes.length
        ? { types: [...new Set(damagingTypes)], fromMoves: true }
        : { types: member.types, fromMoves: false };
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
// members : [{ name, types, ability, moves }]
function computeTeamAnalysis(members) {
    const types = getAnalysisTypes();

    // Défense : pour chaque type d'attaque, multiplicateur subi par chaque membre (talent compris)
    const defense = types.map(atkType => {
        const cells = members.map(m => {
            const withAbility = getDefensiveMultiplier(atkType, m.types, m.ability);
            const withoutAbility = getDefensiveMultiplier(atkType, m.types, null);
            return { value: withAbility, changedByAbility: withAbility !== withoutAbility };
        });
        const multipliers = cells.map(c => c.value);
        return {
            atkType,
            cells,
            weak: multipliers.filter(x => x > 1).length,
            resist: multipliers.filter(x => x < 1).length
        };
    });

    // Points faibles : au moins 2 membres faibles et plus de faibles que de résistants,
    // ou un type contre lequel personne ne résiste alors qu'au moins un membre y est faible
    const threats = defense
        .filter(d => (d.weak >= 2 && d.weak > d.resist) || (d.weak >= 1 && d.resist === 0 && members.length >= 3))
        .sort((a, b) => (b.weak - b.resist) - (a.weak - a.resist) || b.weak - a.weak);

    // Attaque : types utilisés par chaque membre (capacités choisies, sinon STAB)
    const attackers = members.map(m => ({ ...m, attack: getMemberAttackTypes(m) }));
    const offense = types.map(defType => {
        const best = attackers.map(a => Math.max(...a.attack.types.map(atk => getMultiplier(atk, defType))));
        return { defType, best, coveredBy: best.filter(x => x > 1).length };
    });
    const covered = offense.filter(o => o.coveredBy > 0).map(o => o.defType);
    const notCovered = offense.filter(o => o.coveredBy === 0).map(o => o.defType);

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

    return { types, defense, threats, attackers, offense, covered, notCovered, suggestions };
}

function abilityNameFr(ability) {
    return frNames.abilities[ability] || formatLocationName(ability);
}

// === Affiche l'analyse sous l'équipe ===
function renderTeamAnalysis() {
    if (allPokemon.length === 0 || Object.keys(currentTypeChart).length === 0) {
        teamAnalysisDisplay.innerHTML = '';
        return;
    }

    const members = userTeam
        .map(teamMon => ({ teamMon, poke: findTeamMonInGame(teamMon) }))
        .filter(m => m.poke)
        .map(({ teamMon, poke }) => ({
            name: poke.frenchName,
            types: poke.types.map(t => t.type.name),
            ability: getEffectiveAbility(teamMon, poke),
            moves: getChosenMoves(teamMon, poke).filter(Boolean)
        }));

    if (members.length === 0) {
        teamAnalysisDisplay.innerHTML = `
            <h3>Analyse de l'équipe</h3>
            <p class="evolutions-empty">Ajoute des Pokémon à ton équipe pour voir ses faiblesses, ses résistances et sa couverture offensive.</p>
        `;
        return;
    }

    const { defense, threats, attackers, offense, covered, notCovered, suggestions, types } = computeTeamAnalysis(members);

    const threatItems = threats.map(t => `
        <li>${typeBadgeHtml(t.atkType)}
            <span>${t.weak} faible${t.weak > 1 ? 's' : ''}, ${t.resist === 0 ? 'aucun résistant' : `${t.resist} résistant${t.resist > 1 ? 's' : ''}`}</span>
        </li>`).join('');

    const suggestionItems = suggestions.map(s => `
        <li>${typeBadgeHtml(s.type)}
            <span>résiste à ${s.score} de ces types</span>
        </li>`).join('');

    // --- Tableau défensif ---
    const defenseHeader = members.map(m => `
        <th scope="col">${escapeHtml(m.name)}${m.ability ? `<br><span class="analysis-col-note">${escapeHtml(abilityNameFr(m.ability))}</span>` : ''}</th>`).join('');
    const defenseRows = defense.map(d => `
        <tr>
            <th scope="row">${typeBadgeHtml(d.atkType)}</th>
            ${d.cells.map((c, i) => {
                const label = formatMultiplier(c.value);
                const title = c.changedByAbility ? ` title="Modifié par le talent ${escapeHtml(abilityNameFr(members[i].ability))}"` : '';
                return `<td class="mult ${multiplierClass(c.value)}"${title}>${c.changedByAbility ? `${label || '×1'}<span class="ability-mark" aria-label="modifié par le talent">*</span>` : label}</td>`;
            }).join('')}
            <td class="num ${d.weak >= 3 ? 'count-alert' : ''}">${d.weak || ''}</td>
            <td class="num">${d.resist || ''}</td>
        </tr>`).join('');

    // --- Tableau offensif ---
    const offenseHeader = attackers.map(a => `
        <th scope="col">${escapeHtml(a.name)}<br><span class="analysis-col-note">${a.attack.fromMoves ? 'capacités' : 'STAB'}</span></th>`).join('');
    const offenseRows = offense.map(o => `
        <tr>
            <th scope="row">${typeBadgeHtml(o.defType)}</th>
            ${o.best.map(m => `<td class="mult ${m > 1 ? 'eff-good' : m === 0 ? 'mult-immune' : m < 1 ? 'eff-bad' : 'mult-neutral'}">${formatMultiplier(m)}</td>`).join('')}
            <td class="num ${o.coveredBy === 0 ? 'count-alert' : ''}">${o.coveredBy || '0'}</td>
        </tr>`).join('');

    const usingMoves = attackers.filter(a => a.attack.fromMoves).length;
    const offenseSource = usingMoves === 0
        ? 'Avec les types de tes Pokémon (bonus STAB). Choisis leurs capacités dans « Talent et capacités » pour une analyse plus précise.'
        : usingMoves === attackers.length
            ? 'Avec les capacités offensives choisies.'
            : `Avec les capacités choisies (${usingMoves} Pokémon) et les types des autres (STAB).`;

    const ignoredCount = userTeam.length - members.length;
    const ignoredNote = ignoredCount > 0
        ? `<p class="calc-intro">${ignoredCount} membre${ignoredCount > 1 ? 's' : ''} de l'équipe ne ${ignoredCount > 1 ? 'sont' : 'est'} pas dans ce jeu et ${ignoredCount > 1 ? 'sont ignorés' : 'est ignoré'}.</p>`
        : '';

    const abilityNote = currentGeneration >= 3
        ? 'Les talents qui changent les dégâts subis selon le type (Lévitation, Absorb Eau, Isograisse…) sont pris en compte ; les objets ne le sont pas.'
        : 'Pas de talents dans ce jeu. Les objets ne sont pas pris en compte.';

    teamAnalysisDisplay.innerHTML = `
        <h3>Analyse de l'équipe</h3>
        <p class="calc-intro">Table des types de la génération ${currentGeneration}. ${abilityNote}</p>
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
                <p class="analysis-hint">${offenseSource} Tu touches en super efficace ${covered.length} type${covered.length > 1 ? 's' : ''} sur ${types.length}.</p>
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
                        ${defenseHeader}
                        <th scope="col" class="num">Faibles</th>
                        <th scope="col" class="num">Résistants</th>
                    </tr>
                </thead>
                <tbody>${defenseRows}</tbody>
            </table>
        </div>
        <p class="calc-intro analysis-legend">×4 / ×2 : faible · ×½ / ×¼ : résiste · ×0 : immunisé · case vide : dégâts normaux · * : modifié par le talent.</p>

        <h4 class="analysis-table-title">Meilleure efficacité contre chaque type</h4>
        <div class="table-scroll">
            <table class="analysis-table">
                <caption class="visually-hidden">Meilleur multiplicateur que chaque membre peut infliger à chaque type de défenseur</caption>
                <thead>
                    <tr>
                        <th scope="col">Défenseur</th>
                        ${offenseHeader}
                        <th scope="col" class="num">Super efficaces</th>
                    </tr>
                </thead>
                <tbody>${offenseRows}</tbody>
            </table>
        </div>
        <p class="calc-intro analysis-legend">Vert : super efficace · rouge : pas très efficace · ×0 : aucun effet · case vide : efficacité normale.</p>
    `;
}

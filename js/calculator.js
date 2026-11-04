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

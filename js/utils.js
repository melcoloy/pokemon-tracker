// Petites fonctions utilitaires

// === Construit le suffixe "(Forme d'Alola)" / "(Forme de Galar)" avec l'élision correcte ===
function regionalFormSuffix(regionName) {
    const label = regionFormLabelsFr[regionName] || regionName;
    const preposition = /^[aeiouyéèêàâîôûh]/i.test(label) ? 'd\'' : 'de ';
    return `(Forme ${preposition}${label})`;
}

// === Échappe une chaîne avant de l'insérer dans du HTML (texte ou attribut) ===
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// === Limite le nombre de requêtes en vol simultanément ===
async function mapWithConcurrencyBrowser(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index++;
            try {
                results[current] = await fn(items[current], current);
            } catch (e) {
                results[current] = null;
            }
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

// === Formate un nom de zone (slug anglais) en libellé lisible, utilisé seulement si pas de traduction FR ===
function formatLocationName(slug) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// === Normalise un texte pour la recherche : minuscules, sans accents ("Évoli" -> "evoli") ===
function normalizeSearch(text) {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// === Charge un fichier JSON local (renvoie null s'il est absent ou illisible) ===
async function tryLoadJson(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// === Lit / écrit une valeur JSON dans localStorage sans jamais planter (stockage bloqué ou corrompu) ===
function readStorageJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn(`Impossible d'enregistrer "${key}"`, e);
    }
}

// === Fait télécharger un objet au format JSON ===
function downloadJson(obj, fileName) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// === Noms français des types (table des types, sinon nom anglais) ===
function typeNameFr(typeName) {
    return typeTranslations[typeName] || TYPE_NAMES_FR_FALLBACK[typeName] || typeName;
}

// État partagé de l'app et constantes

// État de l'app
let allPokemon = [];
let userTeam = []; // équipe du jeu actif (chaque jeu a sa propre équipe, voir team.js)
let teamsByGame = {}; // { slug du jeu -> équipe }, sauvegardé dans localStorage
let currentGeneratedTeam = [];
const typeTranslations = {}; // cache des traductions de types
const evolutionChainCache = {}; // cache des chaînes d'évolution brutes (par URL), utilisé uniquement lors d'un chargement API live
const abilityNameTranslations = {}; // cache des traductions de talents récupérées en direct (si absentes de names.json)
let frNames = { moves: {}, abilities: {}, items: {}, locations: {}, versions: {}, species: {} }; // data/names.json
let gameExtra = null; // data/extra/{jeu}.json du jeu actif : capacités, zones, conditions d'évolution
let typeChart = {}; // relations de dégâts par type (en anglais), état actuel (dernière génération)
let currentTypeChart = {}; // table des types adaptée à la génération du jeu actif (utilisée par la calculatrice)
let nameToPoke = {}; // nom d'ESPÈCE (anglais) -> objet Pokémon complet (pour le jeu actif)
let evolutionMap = {}; // nom d'espèce (anglais) -> [{ toName, method }] (pour le jeu actif)
let parentMap = {}; // nom d'espèce enfant -> nom d'espèce parent (pour le jeu actif)
let statsChartInstance = null;
let statsSelectedPoke1 = null;
let statsSelectedPoke2 = null;
const gameCache = {}; // cache par jeu : { pokemon, versionGroupName, regionName, evolutionMap, versionNames, extra }
let currentVersionGroupName = null; // version_group du jeu actif (pour filtrer les capacités)
let currentRegionName = null; // région associée au jeu actif (pour le filtre par zone et les formes régionales)
let currentGeneration = 9; // génération du jeu actif (mise à jour à chaque chargement de jeu)
let currentGameVersions = []; // noms des versions individuelles du jeu actif (ex: ['red','blue'])
const locationsCache = {}; // cache des listes de zones (avec Pokémon) par "région::version"
const locationPokemonCache = {}; // cache des Pokémon par zone (clé: "location::version")
let currentLocationSpeciesNames = null; // Set des noms de Pokémon (forme incluse) disponibles dans la zone sélectionnée (null = pas de filtre)
const specificitiesCache = {}; // cache par jeu : { megas, specialForms, exclusives }

// Jeux ayant la mécanique de méga-évolution (génération 6-7 seulement)
const GAMES_WITH_MEGA = new Set(['x', 'omega-ruby', 'sun', 'ultra-sun']);

// Petite liste connue de formes spéciales liées à un jeu précis (non exhaustive)
const SPECIAL_FORMS_DB = [
    { speciesName: 'necrozma', formLabel: 'Formes de fusion (Crin du Crépuscule / Ailes de l\'Aube)', games: ['ultra-sun'] },
    { speciesName: 'zygarde', formLabel: 'Forme 10% / Complète (via Cube Zygarde)', games: ['sun', 'ultra-sun'] },
    { speciesName: 'kyurem', formLabel: 'Kyurem Blanc / Noir (fusion)', games: ['black-2'] },
    { speciesName: 'giratina', formLabel: 'Forme Originelle', games: ['platinum'] }
];

// Libellés français pour les formes régionales
const regionFormLabelsFr = {
    alola: 'Alola',
    galar: 'Galar',
    hisui: 'Hisui',
    paldea: 'Paldea'
};

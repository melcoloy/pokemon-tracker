# Pokémon Tracker

Petite application web en français pour suivre une partie Pokémon : Pokédex du jeu, équipe, générateur d'équipe, calculatrice de types, évolutions, statistiques et capacités.

Les données (types, stats, talents, capacités, zones, conditions d'évolution) sont **adaptées à la génération du jeu choisi** : Rouge/Bleu affiche la stat « Spécial », pas de type Fée avant X/Y, Morsure de type Normal en 1re génération, etc.

## Fonctionnalités

| Onglet | Contenu |
|---|---|
| **Pokédex** | Pokémon du jeu, dans l'ordre du Pokédex régional. Recherche (sans tenir compte des accents), filtres par type et par zone de rencontre. |
| **Mon Équipe** | Jusqu'à 6 Pokémon, **une équipe par jeu**, sauvegardée dans le navigateur. **Analyse de l'équipe** : points faibles partagés, types qui les compenseraient, couverture offensive et tableau des dégâts subis par type d'attaque. |
| **Calculatrice** | Efficacité d'un type d'attaque contre un ou deux types, avec la table des types de la génération du jeu. |
| **Générateur** | Équipe aléatoire (sans doublon de type, évolutions finales, sans légendaires). |
| **Évolutions** | Évolutions possibles de ton équipe et chaîne complète de n'importe quel Pokémon, avec les conditions du jeu (objets, lieux, moment de la journée…). |
| **Statistiques et Capacités** | Radar des stats de base (comparaison de deux Pokémon), talents, et tableaux des capacités (niveau, CT/CS, œuf, donneur) avec type, catégorie, puissance, précision et PP. |
| **Spécificités** | Méga-évolutions, quelques formes spéciales et exclusivités de version. |

L'app fonctionne **sans PokéAPI** une fois les fichiers `data/` présents. Elle ne l'appelle qu'en secours, si un fichier manque.

## Lancer l'app

L'app charge des fichiers JSON : elle doit être servie par un petit serveur web local. Un double-clic sur `index.html` ne suffit pas, car le navigateur bloque alors la lecture des fichiers.

Au choix, depuis la racine du projet :

```bash
python3 -m http.server 8000
```

```bash
npx serve .
```

Puis ouvre <http://localhost:8000>. Dans VS Code, l'extension **Live Server** fonctionne aussi.

Pour publier l'app sur **GitHub Pages** : *Settings → Pages → Deploy from a branch*, branche `main`, dossier `/ (root)`.

## Organisation du code

```
index.html           Page unique
style.css            Styles (mode clair et sombre)
js/                  Code de l'app, chargé dans cet ordre par index.html :
  dom.js             références vers les éléments de la page
  state.js           état partagé (jeu actif, Pokémon, équipe…) et constantes
  utils.js           fonctions utilitaires (échappement HTML, stockage, recherche…)
  generation.js      règles par génération (types, stats, talents, table des types)
  theme.js           mode sombre
  tabs.js            navigation par onglets (souris et clavier)
  game-loader.js     chargement d'un jeu (fichiers locaux, sinon PokéAPI)
  locations.js       filtre par zone
  pokedex.js, team.js, team-analysis.js, generator.js, calculator.js,
  evolutions.js, stats.js, specificities.js   un fichier par onglet
  main.js            démarrage
data/                Données générées (voir ci-dessous)
covers/              Jaquettes des jeux
```

Ce sont des scripts classiques (pas des modules) qui partagent la même portée globale : une fonction définie dans un fichier est utilisable dans les suivants.

## Régénérer les données

Il faut Node 18 ou plus récent. Les fichiers générés sont déjà dans le dépôt : ces commandes ne servent que pour les mettre à jour ou ajouter un jeu.

1. **Pokémon de chaque jeu** (`data/{jeu}.json`) et **table des types** (`data/types.json`), via l'API PokéAPI. Cela prend plusieurs minutes :

   ```bash
   node export-data.js
   ```

   Pour quelques jeux seulement : `node export-data.js red yellow`. Un fichier déjà présent est ignoré : supprime-le pour le régénérer.

2. **Données complémentaires**, à partir des fichiers CSV publiés par PokéAPI sur GitHub. Cela prend quelques secondes :

   ```bash
   node export-csv-data.js
   ```

   Ce script produit :
   - `data/extra/{jeu}.json` : capacités apprises (avec numéros de CT et valeurs de la génération), zones de rencontre et conditions d'évolution propres au jeu ;
   - `data/names.json` : noms français des capacités, talents, objets, lieux, versions et espèces ;
   - `data/past.json` : anciennes stats et anciens talents.

Les boutons « Exporter… » de l'app téléchargent les données du jeu chargé. Ils ne servent que si un jeu a été chargé en direct depuis PokéAPI.

## Limites connues

- PokéAPI n'a pas de données de rencontres sauvages pour certains jeux récents (Écarlate/Violet, Légendes Arceus, Diamant Étincelant…) : le filtre par zone et les exclusivités y sont indisponibles.
- Les exclusivités de version ne tiennent compte que des rencontres sauvages : les Pokémon obtenus autrement (dons, événements) peuvent manquer.
- La liste des formes spéciales est courte et faite à la main.

## Crédits

Données et images : [PokéAPI](https://pokeapi.co/) ([dépôt](https://github.com/PokeAPI/pokeapi)). Pokémon et leurs noms sont des marques de Nintendo, Game Freak et The Pokémon Company ; ce projet est un outil personnel non officiel.

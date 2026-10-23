# JobRadar

> Outil de veille d'offres d'emploi en France, ciblée par métier et variantes linguistiques.

Le MVP local de JobRadar importe le registre de **198 grands groupes** et **100 plateformes d'emploi**, permet de le rechercher et de l'exporter, puis de configurer des métiers suivis avec variantes et exclusions. La collecte, la normalisation et le dédoublonnage des offres sont prévus par le PRD, mais ne sont pas encore implémentés.

- Spécification produit : voir le [PRD](./PRD.md) (version 0.1)
- Statut : MVP local disponible

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Données de départ](#données-de-départ)
4. [Démarrage rapide](#démarrage-rapide)
5. [Configuration](#configuration)
6. [Structure du dépôt](#structure-du-dépôt)
7. [Ajouter une source](#ajouter-une-source)
8. [Gérer les métiers et variantes](#gérer-les-métiers-et-variantes)
9. [Tests et qualité du matching](#tests-et-qualité-du-matching)
10. [Conformité et bonnes pratiques de collecte](#conformité-et-bonnes-pratiques-de-collecte)
11. [Roadmap](#roadmap)
12. [Contribuer](#contribuer)

---

## Fonctionnalités

| Fonctionnalité | Statut |
|---|---|
| Registre des sources importé depuis les deux fichiers Excel | Disponible en local |
| Ajout, recherche, filtres et export CSV des sources | Disponible en local |
| Fiche d’audit des sources (CGU, robots.txt, méthode, confidentialité, notes) | Disponible en local |
| Sélection d’un maximum de 40 sources pilotes après audit complet | Disponible en local |
| Configuration des métiers, variantes et exclusions | Disponible en local |
| Taxonomie simplifiée des secteurs, CA et effectifs normalisés | Disponible en local |
| Recherche ponctuelle par mots-clés via l’API officielle France Travail | Disponible avec identifiants API |
| Connecteurs API, flux/JSON-LD, ATS et HTML | À construire |
| Normalisation, dédoublonnage et cycle de vie des offres | À construire |
| Matching lexical, sémantique et feedback utilisateur | À construire |
| Agrégation multi-sources et tableau de bord des offres | À construire |
| Suggestion automatique de variantes (référentiel + LLM + corpus) | V1 |
| Alertes email / Slack / webhook | V1 |
| API publique | V1 |
| Analytique marché, intégrations CRM/ATS | Plus tard |

## Architecture cible

Le schéma ci-dessous décrit la cible du PRD ; le MVP actuel est une application React avec un proxy API local France Travail, sans base de données ni worker de collecte.

```
Registre des sources
        │
   Planificateur ──► Connecteurs (API · flux · ATS · HTML)
                            │
                     Stockage brut (S3)
                            │
                 Normalisation & enrichissement
                            │
               Déduplication (offre canonique)
                            │
        Matching métier (lexical → embeddings → LLM)
                            │
          Index de recherche ◄──► PostgreSQL + pgvector
                            │
              API REST · Interface web · Alertes
```

**Pile proposée** (modifiable) :

- Collecte et traitements : Python 3.12, httpx, Scrapy, Playwright
- Orchestration : Celery + Redis (ou Temporal)
- Données : PostgreSQL 16 + pgvector, stockage objet compatible S3
- Recherche : recherche plein texte PostgreSQL au départ, OpenSearch si besoin
- API : FastAPI
- Interface : Next.js + TypeScript
- Infra : Docker Compose en local, hébergement UE en production

## Données de départ

Les deux fichiers Excel d'amorçage sont lus directement depuis la racine du dépôt :

| Fichier | Contenu | Rôle dans JobRadar |
|---|---|---|
| `200_grands_groupes_france_ca_effectifs-v3.xlsx` | Entreprise, secteur, CA, effectifs, siège, URL du site carrière, description | Table `employer` + une source de type `career_site` par ligne |
| `sites_emploi_france_100-v2.xlsx` | Plateforme, URL, catégorie, cible, type d'accès, description | Table `source` de type `job_board` ou `aggregator` |

Points à connaître avant l'import :

- Le fichier des groupes contient environ 198 lignes malgré son titre.
- CA et effectifs sont du texte (« 65,4 Mds € », « 148 000 ») : le script d'import les convertit en nombres.
- Secteurs et catégories sont libres : ils sont rapprochés d'une taxonomie contrôlée (`config/taxonomies/`).
- Les sites régionaux HelloWork (ParisJob, OuestJob, etc.) sont regroupés sous un même `source_group` pour éviter les doublons.
- Les agrégateurs ont une priorité faible en cas de doublon avec une source primaire.

## Démarrage rapide

Prérequis : Node.js 20+ et npm. Les deux classeurs Excel doivent rester à la racine du dépôt.

```bash
npm install
cp .env.example .env
# Renseigner dans .env les identifiants API délivrés par France Travail
npm run dev
```

Ouvrez l’URL affichée par Vite (par défaut http://localhost:5173). La recherche d’offres est disponible dans l’onglet « Offres d’emploi » et utilise uniquement l’API officielle France Travail, à la demande. Le proxy local s’exécute sur le port 8000 et conserve les secrets côté serveur. Sans identifiants, le registre et le reste de l’interface restent utilisables, mais aucune annonce ne sera affichée.

Pour vérifier la compilation de production :

```bash
npm run build
```

Le MVP importe les 198 employeurs et 100 plateformes depuis les fichiers Excel, propose la recherche, les filtres et l’export CSV du registre, et permet de configurer localement les métiers suivis, variantes, exclusions, sources ajoutées et fiches d’audit. Les fiches consignent l’examen des CGU, de `robots.txt`, de la méthode d’accès et des données personnelles ; seuls les dossiers complets marqués « Autorisée » peuvent rejoindre la liste pilote (40 maximum). Ces réglages sont conservés dans le navigateur et ne constituent pas un avis juridique.

La collecte planifiée multi-sources, le dédoublonnage, les comptes multi-utilisateurs, les alertes et le stockage serveur ne sont pas encore connectés. Les recherches France Travail sont ponctuelles et ne sont pas conservées. Pour les autres sources, réaliser l’audit juridique et technique avant d’activer des connecteurs.

## Configuration

Variables principales (`.env`) :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `REDIS_URL` | Broker de tâches |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Stockage des réponses brutes |
| `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` | API Offres d'emploi de France Travail |
| `API_PORT` | Port local du proxy (défaut : `8000`) |
| `LLM_API_KEY`, `LLM_MODEL` | Suggestion de variantes et arbitrage des cas ambigus |
| `EMBEDDING_MODEL` | Modèle d'embeddings pour le matching sémantique |
| `CRAWL_USER_AGENT` | Identifiant du robot, avec adresse de contact |
| `CRAWL_DEFAULT_RATE_LIMIT` | Requêtes par seconde et par domaine (défaut conservateur) |

Ne jamais committer le fichier `.env`.

## Structure du dépôt

```
jobradar/
├── apps/
│   ├── api/              # FastAPI : auth, métiers, offres, alertes
│   └── web/              # Next.js : tableau de bord, administration
├── workers/
│   ├── connectors/       # un module par type de connecteur et par ATS
│   ├── pipeline/         # normalisation, déduplication, matching
│   └── scheduler/        # planification par source
├── config/
│   ├── sources/          # surcharges et règles par source (YAML)
│   └── taxonomies/       # secteurs, contrats, régions
├── data/
│   ├── seed/             # fichiers Excel de départ
│   └── eval/             # jeux de test annotés par métier
├── docs/
│   └── PRD.md
├── scripts/              # import, maintenance
├── docker-compose.yml
├── Makefile
└── README.md
```

## Ajouter une source

1. Ajouter la ligne dans le registre (interface d'administration ou fichier Excel de départ).
2. Choisir la méthode de collecte, par ordre de préférence : API officielle, flux ou JSON-LD, endpoint ATS public, HTML.
3. Si un connecteur existant convient (ex. `workday`, `smartrecruiters`, `greenhouse`), déclarer la source dans `config/sources/<nom>.yaml` :

```yaml
name: Exemple SA
type: career_site
connector: workday
url: https://example.com/careers
rate_limit: 0.5        # requêtes/seconde
schedule: "0 */6 * * *"
priority: high
```

4. Sinon, créer un connecteur dans `workers/connectors/` en implémentant l'interface `fetch()` → `parse()` → liste d'offres brutes.
5. Vérifier la collecte avec `make crawl SOURCE=<nom>`, puis contrôler l'état de santé de la source dans l'administration.

Avant d'activer une source, vérifier ses CGU et son `robots.txt` (voir plus bas).

## Gérer les métiers et variantes

Un **métier** est un concept canonique (ex. « Développeur logiciel »). Il possède des **variantes** typées :

| Type | Exemples |
|---|---|
| Synonyme | ingénieur logiciel, concepteur-développeur |
| Anglicisme | software engineer, software developer |
| Féminin / inclusif | développeuse, développeur·se |
| Abréviation | dev, DAF, RRH |
| Niveau | junior, senior, lead |
| Intitulé maison | titres propres à un employeur |

Les mentions `(H/F)`, `(F/H)`, `(H/F/X)` sont ignorées à la comparaison. Des **exclusions** écartent les faux amis (ex. « développeur immobilier »).

Cascade de matching : normalisation → correspondance lexicale et floue → similarité par embeddings → arbitrage LLM pour les cas ambigus. Chaque rattachement conserve un score, la variante déclenchante et la méthode utilisée, visibles dans l'interface.

Exemple de définition via l'API :

```bash
curl -X POST http://localhost:8000/v1/occupations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Développeur logiciel",
    "rome_code": "M1805",
    "variants": [
      {"text": "software engineer", "type": "anglicism", "lang": "en"},
      {"text": "ingénieur logiciel", "type": "synonym", "lang": "fr"},
      {"text": "dev", "type": "abbreviation", "lang": "fr"}
    ],
    "exclusions": ["développeur immobilier", "développeur commercial"]
  }'
```

## Tests et qualité du matching

Objectifs du MVP : rappel ≥ 80 %, précision ≥ 90 % sur le jeu de test (cibles V1 : 90 % / 95 %).

- `data/eval/` contient, pour chaque métier, des intitulés annotés (pertinent / non pertinent).
- `make eval` calcule précision et rappel et échoue si les seuils ne sont pas atteints.
- Chaque évolution des variantes ou des seuils doit être accompagnée d'une exécution de `make eval`.
- Les retours « Ce n'est pas ce métier » et « Il manque ce métier » alimentent les suggestions de variantes.

## Conformité et bonnes pratiques de collecte

- Respecter `robots.txt`, les conditions d'utilisation et le droit des bases de données ; l'analyse juridique par source précède son activation.
- Privilégier les API officielles et programmes partenaires. LinkedIn, Indeed et plusieurs agrégateurs interdisent la collecte automatisée : ne pas les collecter directement sans accord, s'appuyer sur les sources primaires.
- Limiter le débit par domaine, s'identifier via `CRAWL_USER_AGENT` et retirer rapidement une source sur demande.
- RGPD : ne pas conserver les données personnelles inutiles (noms de recruteurs, emails), définir une durée de rétention, héberger dans l'UE.
- Ne jamais contourner une authentification, un captcha ou une protection anti-bot.

Ce README ne constitue pas un avis juridique : faire valider le périmètre de collecte par un conseil.

## Roadmap

| Phase | Contenu |
|---|---|
| 0 — Fondations | Import des fichiers, modèle de données, audit juridique et technique des sources |
| 1 — MVP | 30 à 40 sources pilotes, déduplication, 10 métiers avec variantes, recherche et tableau de bord |
| 2 — V1 | Extension à la majorité des ~300 sources, assistant de variantes, alertes, API, facturation |
| 3 — Échelle | Analytique marché, intégrations CRM/ATS, multilingue européen, salaires |

## Contribuer

1. Créer une branche depuis `main` : `git checkout -b feat/ma-fonctionnalite`
2. Respecter les linters (`make lint`) et ajouter des tests
3. Pour un nouveau connecteur : inclure un jeu de réponses enregistrées pour les tests hors ligne
4. Ouvrir une pull request décrivant le changement et l'impact sur le matching (`make eval`)

Je vais distinguer ce qui existe déjà dans JobRadar de ce qu’il faut construire pour couvrir réellement chaque source, puis classer les blocages par étapes. Je vérifie les catégories et types d’accès présents dans les deux fichiers pour que la liste reflète leur diversité, pas seulement l’API France Travail.

Ran terminal command:  node --input-type=module -e 'import * as XLSX from "@e965/xlsx"; import fs from "node:fs"; for (const file of ["200_grands_groupes_france_ca_effectifs-v3.xlsx","sites_emploi_france_100-v2.xlsx"]) { const wb=XLSX.read(fs.readFileSync(file)); const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}); const headers=rows.find(r=>r.includes("Nom du Groupe / Entreprise")||r.includes("Nom de la Plateforme")); const data=rows.slice(rows.indexOf(headers)+1).map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]??""]))).filter(row=>row[headers[0]||"N°"]); console.log("\n"+file+" rows="+data.length); for (const key of ["Secteur d'Activité","Catégorie / Secteur","Type d'Accès / Structure"]) { const counts=new Map(); for (const row of data) if (row[key]) counts.set(row[key],(counts.get(row[key])||0)+1); if (counts.size) console.log(key+": "+[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>name+" ("+count+")").join("; ")); } }'
Tool execution failed with exit code 1

Searched for regex `crawl|connector|fetch\('/api/jobs|offersdemploi|offres d’emploi` (`**/src/**`), 3 results

Searched for regex `Connecteurs|collecte planifiée|dédoublonnage|France Travail|API` (`**/Readme.md`), 23 results

Le code confirme que, pour l’instant, seule la recherche ponctuelle France Travail est prévue ; les 198 sites carrières et les 100 plateformes n’ont pas de connecteur. Ma commande de comptage a buté sur un guillemet dans un nom de colonne, je la relance pour préciser les types d’accès à prendre en charge.

Ran terminal command:  node --input-type=module <<'NODE'
import * as XLSX from '@e965/xlsx';
import fs from 'node:fs';
const file = 'sites_emploi_france_100-v2.xlsx';
const workbook = XLSX.read(fs.readFileSync(file));
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
const headerIndex = rows.findIndex((row) => row.includes('Nom de la Plateforme'));
const headers = rows[headerIndex];
const records = rows.slice(headerIndex + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))).filter((record) => record['Nom de la Plateforme']);
console.log(`plateformes=${records.length}`);
for (const key of ['Catégorie / Secteur', "Type d'Accès / Structure"]) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key] || 'Non renseigné';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  console.log(`\n${key}`);
  for (const [value, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`${count}\t${value}`);
}
NODE

**État actuel :** JobRadar importe les 198 employeurs et les 100 plateformes, mais ce sont des **références de sources**, pas des annonces. L’écran permet de chercher des offres France Travail, mais cette connexion n’a pas encore été validée avec de vrais identifiants. Pour les autres sources, aucun connecteur de collecte n’est en place.

Pour obtenir réellement les offres de toutes les sources recensées, il manque :

1. **Qualifier chaque source.** Vérifier ses CGU, `robots.txt`, règles de confidentialité et moyens d’accès autorisés. Certaines plateformes exigent une API, un partenariat ou un abonnement ; d’autres interdisent la collecte automatisée. « Toutes les sources du registre » ne signifie donc pas forcément « toutes collectables ».

2. **Établir une fiche technique par source.** Identifier son mode d’accès, sa méthode de collecte, son rythme, sa priorité, ses limites de débit, son état de santé et les éventuelles dépendances à un contrat ou à des identifiants.

3. **Développer et maintenir les connecteurs.** Il en faudra pour l’API officielle France Travail, les ATS utilisés par les sites carrières, les flux RSS/sitemaps/JSON-LD disponibles, puis des connecteurs spécifiques uniquement lorsque les règles l’autorisent. Les 100 plateformes ont des accès très différents ; les 10 sites régionaux HelloWork devront être regroupés pour limiter les doublons.

4. **Mettre en place la collecte fiable.** Planification, quotas par domaine, retries, détection des connecteurs cassés et stockage des réponses brutes. Pour l’instant, la recherche est ponctuelle : il n’y a ni collecte planifiée ni historique serveur.

5. **Normaliser les annonces.** Transformer les réponses de chaque source en un format commun : intitulé, employeur, lieu, région, télétravail, contrat, date, salaire, description, URL et source.

6. **Dédoublonner et suivre les changements.** Regrouper les copies d’une même offre, conserver ses sources d’origine et suivre son cycle de vie : nouvelle, active, repostée ou expirée.

7. **Relier les annonces aux métiers suivis.** Les variantes de « Juriste » sont configurables, mais le moteur qui les compare aux annonces n’existe pas encore. Il faut ajouter le matching, les exclusions, un score et une explication du rattachement.

8. **Compléter les vues produit.** Afficher les résultats multi-sources, filtres, historique d’une annonce, export/API et éventuellement alertes. Aujourd’hui, l’écran d’offres est prévu pour France Travail seulement.

9. **Ajouter les fondations de production.** Base de données, comptes et isolation par organisation, gestion sécurisée des secrets, rétention et suppression des données, logs et métriques par source, tests de qualité de collecte et de matching.

**La meilleure prochaine étape** est de valider une première recherche réelle France Travail, puis de construire un parcours complet sur un petit lot pilote : collecte autorisée → normalisation → dédoublonnage → affichage. Ensuite, on étend aux 30–40 sources pilotes après audit, puis au reste du registre. Le proxy actuel dans `server.mjs` est un point de départ, mais l’appel réel à France Travail reste à confirmer avec des identifiants valides. Le détail du périmètre est dans le PRD et le README.

## Licence

À définir (propriétaire par défaut).
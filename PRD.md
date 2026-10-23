PRD — JobRadar : veille d'offres d'emploi par métier
Version 0.1 · 23 octobre 2026 · Statut : brouillon pour validation · Nom de travail : JobRadar
1. Résumé
JobRadar est un SaaS qui collecte, dédoublonne et suit en continu les offres d'emploi publiées en France sur deux familles de sources : les sites carrières officiels des grands groupes et une centaine de plateformes d'emploi. L'utilisateur définit les métiers qui l'intéressent ; le produit retrouve toutes les offres correspondantes, y compris celles qui utilisent une formulation différente (synonyme, anglicisme, abréviation, variante H/F, intitulé maison).
Proposition de valeur : voir toutes les offres d'un métier, une seule fois, quelle que soit la façon dont elle est écrite et où elle est publiée.
2. Problème
• Une même offre est diffusée sur 5 à 15 sites (agrégateurs, job boards, site carrière). Les recherches manuelles produisent des doublons et des angles morts.
• Un métier a de nombreux intitulés : « Développeur Full Stack », « Software Engineer », « Ingénieur logiciel », « Dev web », « Développeuse (H/F) ». Une recherche par mot-clé en rate la moitié.
• Les grands groupes publient souvent sur leur propre site avant ou à la place des job boards, et personne ne les agrège de façon fiable.
• Il n'existe pas de vue historique : quand une offre a-t-elle été publiée, repostée, retirée ?
3. Actifs de départ (analyse des fichiers fournis)
Fichier 1 — Grands groupes (≈198 lignes, titre annonçant 200) : nom, secteur, chiffre d'affaires, effectifs, siège, URL du site carrière, description. Usage : registre des employeurs et liste de connecteurs « site carrière » (une URL par entreprise).
Fichier 2 — Sites emploi (100 lignes) : nom, URL, catégorie, cible, type d'accès, description. Usage : registre des sources de type job board. Il contient des généralistes, des agrégateurs (Indeed, Jooble, Jobrapido…), 10 sites régionaux du groupe HelloWork, des sites tech/freelance, jeunes/alternance/stages, intérim et sectoriels.
Points d'attention à traiter à l'import :
• Les CA et effectifs sont du texte (« 65,4 Mds € », « 148 000 ») : à normaliser en valeurs numériques.
• Les catégories et secteurs sont libres et hétérogènes (ex. « Assurance », « Assurance Mutualiste », « Banque & Assurance ») : à rattacher à une taxonomie contrôlée.
• Les 10 sites régionaux HelloWork partagent très probablement un même inventaire : à traiter comme un seul groupe de sources pour éviter le triple comptage.
• Les agrégateurs republient les offres des autres sources : ils servent à la couverture mais ont une priorité faible en cas de doublon.
• Quelques entrées sont à vérifier (doublons de plateformes proches, libellés tronqués, URL de pages génériques plutôt que de listes d'offres).
4. Utilisateurs cibles
Persona
Besoin principal
Recruteur / sourceur / cabinet
Voir toutes les offres concurrentes pour un métier, benchmarker salaires et délais
Direction RH / marque employeur
Suivre comment les concurrents recrutent et nomment leurs postes
Veille commerciale (sales intelligence)
Détecter des signaux d'embauche comme déclencheur de prospection
Analyste marché / observatoire
Tendances par métier, secteur, région
Candidat avancé (secondaire)
Alertes exhaustives sur un métier ciblé
Persona primaire pour le MVP : recruteurs et cabinets de recrutement.
5. Objectifs, non-objectifs et indicateurs
Objectifs
1. Couverture : ≥ 80 % des offres publiées sur un échantillon de contrôle de 20 métiers, sur les sources suivies.
2. Rappel linguistique : ≥ 90 % des offres d'un métier détectées malgré les variantes d'intitulé.
3. Précision : ≥ 95 % des offres affichées pour un métier sont réellement de ce métier.
4. Fraîcheur : offre visible en moins de 6 h après publication pour les sources prioritaires.
5. Dédoublonnage : < 3 % de doublons résiduels perçus par l'utilisateur.
Non-objectifs (v1) : pas de dépôt de candidature, pas de CV matching, pas de marketplace de recrutement, pas de couverture hors France, pas de scraping de contenus derrière authentification.
Indicateurs produit : nombre de métiers suivis par compte, taux d'ouverture des alertes, rétention à 90 jours, taux de corrections manuelles du matching (doit baisser), coût d'ingestion par 1 000 offres.
6. Périmètre fonctionnel
Priorités : P0 = MVP, P1 = V1, P2 = ensuite.
F1. Registre des sources (P0)
• Import des deux fichiers fournis comme jeu de départ (employeurs et sources).
• Chaque source a un type (site carrière, job board, agrégateur, API publique, flux ATS), une méthode de collecte, une fréquence, un état de santé et une priorité.
• Console d'administration : activer/désactiver, relancer, voir les erreurs, ajouter une source.
F2. Collecte multi-connecteurs (P0)
Ordre de préférence de collecte, du plus au moins robuste et légitime :
1. API officielles (France Travail Offres d'emploi, La Bonne Alternance, APIs d'ATS publiques).
2. Flux structurés : sitemaps, RSS, données JobPosting schema.org (JSON-LD) présentes sur les pages d'offre.
3. Endpoints ATS publics des sites carrières (Workday, SmartRecruiters, Greenhouse, Lever, Taleo, Eightfold…) — à détecter automatiquement par site.
4. Extraction HTML ciblée (navigateur headless) en dernier recours, uniquement si les CGU et robots.txt l'autorisent.
• Planification par source, retry avec backoff, quotas par domaine, stockage de la réponse brute.
F3. Normalisation et enrichissement (P0)
Champs normalisés : intitulé brut et nettoyé, employeur (rattaché au registre), lieu (commune, département, région, télétravail), type de contrat (CDI, CDD, intérim, alternance, stage, freelance), niveau d'expérience, salaire si présent, date de publication, description, URL canonique, source. Extraction optionnelle de compétences et du code ROME le plus proche.
F4. Dédoublonnage et cycle de vie (P0)
• Clé d'identité : employeur + intitulé normalisé + lieu + empreinte de description, avec rapprochement flou. Une « offre canonique » regroupe toutes ses occurrences par source.
• États : nouvelle, active, repostée, expirée. Détection de disparition après N passages manqués.
• Historique complet (première vue, dernière vue, durée de vie).
F5. Métiers suivis et variantes linguistiques (P0)
Voir section 7. C'est le cœur différenciant du produit.
F6. Recherche, filtres et tableau de bord (P0)
• Vue par métier : nouvelles offres, volume actif, top employeurs, régions, contrats.
• Filtres : métier, variante matchée, employeur, secteur, région, contrat, date, source, télétravail.
• Fiche offre : toutes les sources où elle apparaît, historique, texte d'origine.
• Export CSV et accès API.
F7. Alertes et intégrations (P1)
Alertes email, Slack et webhook (temps réel ou digest quotidien/hebdomadaire) par métier ou par employeur. Intégrations CRM/ATS plus tard.
F8. Analytique marché (P1)
Tendances par métier, comparaison d'employeurs, délais moyens de publication, fourchettes de salaire quand disponibles, mots-clés montants.
F9. Comptes, équipes et facturation (P0 simple, P1 complet)
Multi-utilisateurs par organisation, rôles (admin, membre, lecture), plans par nombre de métiers suivis et de sièges, essai gratuit.
7. Moteur de variantes linguistiques
7.1 Modèle
Un métier est un concept canonique (ex. « Développeur logiciel ») qui possède un ensemble de variantes typées :
Type de variante
Exemples
Synonyme FR
ingénieur logiciel, concepteur-développeur
Anglicisme / EN
software engineer, software developer
Féminin / inclusif
développeuse, développeur·se, développeur(se)
Mention de genre
(H/F), (F/H), (H/F/X) à ignorer lors de la comparaison
Abréviation / jargon
dev, DAF, RRH, CDP
Niveau
junior, confirmé, senior, lead, principal
Spécialité
full stack, backend, front-end
Intitulé maison
titres internes propres à un employeur
Faute / graphie
espaces, tirets, accents, casse
Chaque variante porte une langue, un poids de confiance, une origine (manuelle, suggérée, référentiel) et un statut (validée, à revoir, rejetée). Des exclusions permettent d'écarter les faux amis (ex. « développeur immobilier » pour un métier IT).
7.2 Création assistée d'un métier
1. L'utilisateur saisit un métier en texte libre ou le choisit dans un référentiel (ROME de France Travail, ESCO pour le multilingue).
2. Le système propose automatiquement des variantes issues du référentiel, d'un LLM et du corpus déjà collecté (intitulés fréquents proches).
3. L'utilisateur valide, retire ou ajoute ; chaque décision améliore les suggestions suivantes.
7.3 Pipeline de matching (en cascade)
1. Normalisation : minuscules, accents, ponctuation, suppression de (H/F), lemmatisation légère FR/EN.
2. Lexical : correspondance exacte et floue sur variantes validées, avec dictionnaire de synonymes dans le moteur de recherche.
3. Sémantique : similarité par embeddings entre l'intitulé (et le début de description) et le métier canonique, avec seuil.
4. Arbitrage LLM pour les cas ambigus (zone de confiance intermédiaire), avec justification stockée.
5. Score et explication : chaque rattachement porte un score, la variante déclenchante et la méthode, visibles par l'utilisateur.
7.4 Boucle d'amélioration
• Bouton « Ce n'est pas ce métier » / « Il manque ce métier » sur chaque offre.
• Les intitulés non rattachés fréquents sont proposés comme variantes candidates.
• Jeu de test annoté par métier pour mesurer précision et rappel à chaque évolution du matching.
8. Architecture cible
Flux : Registre des sources → Planificateur → Connecteurs (API, flux, ATS, HTML) → Stockage brut → Normalisation → Dédoublonnage → Matching métier → Index de recherche → API, interface web, alertes.
Pile suggérée (modifiable) : Python pour les workers de collecte (Scrapy, Playwright, httpx), file de tâches (Celery ou Temporal) sur Redis, PostgreSQL avec pgvector pour les données et les embeddings, OpenSearch ou recherche plein texte Postgres pour le filtrage, stockage objet pour les réponses brutes, application web Next.js + API REST, observabilité (logs structurés, métriques par source).
9. Modèle de données (principales entités)
• organization, user, subscription
• employer (issu du fichier 1 : nom, secteur normalisé, CA, effectifs, siège, URL carrière)
• source (issue du fichier 2 et des sites carrières : type, méthode, fréquence, santé, priorité, groupe)
• job_raw (réponse brute, source, date de collecte)
• job (offre canonique) et job_occurrence (présence sur une source donnée, URL, dates)
• occupation (métier canonique, code ROME/ESCO) et occupation_variant (texte, type, langue, poids, statut)
• job_match (job, occupation, score, méthode, variante déclenchante, retour utilisateur)
• tracking (métiers et filtres suivis par une organisation) et alert
10. Exigences non fonctionnelles et conformité
• Légalité de la collecte : respect de robots.txt, des CGU et du droit des bases de données ; l'analyse juridique par source est un prérequis avant activation. LinkedIn, Indeed et plusieurs grands agrégateurs interdisent la collecte automatisée : privilégier leurs programmes partenaires ou API officielles, sinon ne pas les collecter directement et s'appuyer sur la source primaire.
• RGPD : les offres contiennent parfois des noms de recruteurs ; minimiser, ne pas indexer les données personnelles inutiles, définir une durée de conservation.
• Respect des sites : limitation de débit par domaine, identification du robot, retrait rapide sur demande.
• Performance : recherche < 500 ms au p95 ; pipeline capable de traiter 1 million d'offres actives.
• Fiabilité : détection automatique des connecteurs cassés (chute de volume, changement de structure) avec alerte interne.
• Sécurité : isolation par organisation, chiffrement, journal d'audit, hébergement UE.
11. Roadmap
Phase
Contenu
Critère de sortie
0 — Fondations (3–4 sem.)
Import des deux fichiers, modèle de données, audit juridique et technique des sources (méthode de collecte par source)
Chaque source classée par méthode et faisabilité
1 — MVP (8–10 sem.)
30 à 40 sources pilotes (France Travail + sites carrières à ATS standard + quelques job boards), normalisation, dédoublonnage, 10 métiers avec variantes, recherche et dashboard, comptes
Rappel ≥ 80 % et précision ≥ 90 % sur le jeu de test ; 5 clients pilotes
2 — V1 (8 sem.)
Extension à la majorité des 300 sources, assistant de variantes, boucle de feedback, alertes, export/API, facturation
20 clients payants, fraîcheur < 6 h
3 — Échelle
Analytique marché, intégrations CRM/ATS, multilingue européen, salaires
Rétention à 90 jours ≥ 70 %
12. Risques et mitigations
Risque
Mitigation
Blocage ou interdiction de collecte
Priorité aux API et flux autorisés, accords de partenariat, audit juridique source par source
Maintenance des connecteurs HTML
Privilégier ATS standards et JSON-LD, tests de santé automatiques, budget de maintenance
Faux positifs de matching
Seuils, exclusions, arbitrage LLM, feedback utilisateur, jeu de test
Doublons entre sources
Offre canonique, priorité de source, rapprochement flou
Coût de l'IA
Cascade lexical d'abord, embeddings mis en cache, LLM uniquement sur les cas ambigus
Couverture inégale (PME, offres hors sites suivis)
Agrégateurs et API publiques en complément, ajout de sources à la demande
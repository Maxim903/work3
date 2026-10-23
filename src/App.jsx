import { useEffect, useMemo, useState } from 'react';
import * as XLSX from '@e965/xlsx';
import {
  ArrowDownToLine,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Command,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Search,
  FileSpreadsheet,
  Filter,
  Globe2,
  LayoutDashboard,
  Plus,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

const workbookFiles = {
  employers: '/200_grands_groupes_france_ca_effectifs-v3.xlsx',
  platforms: '/sites_emploi_france_100-v2.xlsx',
};

const navItems = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'offers', label: 'Offres d’emploi', icon: BriefcaseBusiness },
  { id: 'sources', label: 'Registre des sources', icon: Globe2 },
  { id: 'occupations', label: 'Métiers suivis', icon: Target },
];

const auditMethods = [
  'API officielle',
  'Flux RSS, sitemap ou JSON-LD',
  'ATS public',
  'Partenariat ou accord',
  'HTML à justifier',
];

const emptyAudit = {
  status: 'À examiner',
  method: '',
  priority: 'Normale',
  frequency: 'Quotidienne',
  termsReviewed: false,
  robotsReviewed: false,
  methodVerified: false,
  privacyReviewed: false,
  notes: '',
  pilot: false,
};

function isAuditComplete(audit) {
  return Boolean(audit && audit.status === 'Autorisée' && audit.method
    && audit.termsReviewed && audit.robotsReviewed && audit.methodVerified && audit.privacyReviewed);
}

function cell(row, key) {
  return String(row[key] ?? '').trim();
}

function parseAmount(value) {
  const text = String(value ?? '').toLowerCase().replace(/\s/g, '').replace(',', '.');
  const number = Number(text.match(/[\d.]+/)?.[0]);
  if (!Number.isFinite(number)) return null;
  if (/mds?|milliards?/.test(text)) return Math.round(number * 1_000_000_000);
  if (/millions?|\bm\b/.test(text)) return Math.round(number * 1_000_000);
  if (/\bk\b|milliers?/.test(text)) return Math.round(number * 1_000);
  return Math.round(number);
}

function normalizeSector(value) {
  const text = value.toLocaleLowerCase('fr');
  const groups = [
    ['Banque & finance', /banque|finance|financier|bourse/],
    ['Assurance', /assur/],
    ['Santé & pharmacie', /sant|pharma|médical/],
    ['Énergie & environnement', /énerg|environnement|eau|pétrole/],
    ['Technologie', /informatique|technolog|numérique|télécom|logiciel/],
    ['Industrie & transport', /industrie|aéronaut|automobile|transport|logistique/],
    ['Commerce & distribution', /distribution|commerce|retail|luxe|agroalimentaire/],
    ['Services', /service|conseil|communication|média|publicité/],
  ];
  return groups.find(([, pattern]) => pattern.test(text))?.[0] || value || 'Non renseigné';
}

function classifyPlatform(row) {
  const text = `${cell(row, 'Catégorie / Secteur')} ${cell(row, "Type d'Accès / Structure")} ${cell(row, 'Nom de la Plateforme')}`.toLocaleLowerCase('fr');
  if (/agrég|métamoteur|moteur de recherche/.test(text)) return 'Agrégateur';
  if (/api|public|institution|service-public/.test(text)) return 'API publique';
  return 'Job board';
}

function sourceGroup(name) {
  if (/hellowork|ouestjob|parisjob|nordjob|sudouestjob|rhonealpesjob|estjob|paca.?job|centrejob|alsacejob|midipyreneesjob/i.test(name)) return 'HelloWork';
  return '';
}

function parseWorkbook(buffer, kind) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const expectedHeader = kind === 'employers' ? 'Nom du Groupe / Entreprise' : 'Nom de la Plateforme';
  const headerIndex = sheetRows.findIndex((row) => row.includes(expectedHeader));
  if (headerIndex < 0) throw new Error(`En-tête introuvable : ${expectedHeader}`);
  const headers = sheetRows[headerIndex];
  const rows = sheetRows.slice(headerIndex + 1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? '']),
  ));

  if (kind === 'employers') {
    return rows.filter((row) => cell(row, 'Nom du Groupe / Entreprise')).map((row, index) => {
      const name = cell(row, 'Nom du Groupe / Entreprise');
      return {
        id: `employer-${index}`,
        name,
        kind: 'Site carrière',
        sector: normalizeSector(cell(row, "Secteur d'Activité")),
        rawSector: cell(row, "Secteur d'Activité"),
        revenue: parseAmount(cell(row, "Chiffre d'Affaires (CA)")),
        revenueLabel: cell(row, "Chiffre d'Affaires (CA)"),
        employees: parseAmount(cell(row, 'Nombre de Salariés')),
        employeeLabel: cell(row, 'Nombre de Salariés'),
        location: cell(row, 'Siège / Implantation'),
        url: cell(row, 'Site Carrière (URL)'),
        description: cell(row, 'Présentation & Activité'),
        sourceGroup: sourceGroup(name),
        access: 'Site carrière',
      };
    });
  }

  return rows.filter((row) => cell(row, 'Nom de la Plateforme')).map((row, index) => {
    const name = cell(row, 'Nom de la Plateforme');
    return {
      id: `platform-${index}`,
      name,
      kind: classifyPlatform(row),
      sector: cell(row, 'Catégorie / Secteur') || 'Non renseigné',
      audience: cell(row, 'Cible / Public Visé'),
      access: cell(row, "Type d'Accès / Structure") || 'À qualifier',
      description: cell(row, 'Description & Spécificités'),
      url: cell(row, 'Lien Web (URL)'),
      sourceGroup: sourceGroup(name),
    };
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(value || 0);
}

function formatRevenue(value) {
  if (!value) return '—';
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} Md€`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value / 1_000_000)} M€`;
  return `${formatNumber(value)} €`;
}

function formatJobDate(value) {
  if (!value) return 'Date non précisée';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date non précisée'
    : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function loadStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadOccupations() {
  const stored = loadStored('jobradar-occupations', []);
  const isJuristeDemo = new URLSearchParams(window.location.search).get('demo') === 'juriste';
  if (!isJuristeDemo || stored.some((occupation) => occupation.name.toLocaleLowerCase('fr') === 'juriste')) return stored;
  return [...stored, {
    id: 'demo-juriste',
    name: 'Juriste',
    variants: ['juriste d’entreprise', 'juriste en droit social', 'juriste contrats', 'juriste conformité', 'legal counsel', 'legal advisor'],
    exclusions: [],
    createdAt: new Date().toISOString(),
    demo: true,
  }];
}

function App() {
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get('demo') === 'juriste' ? 'offers' : 'overview');
  const [employers, setEmployers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [customSources, setCustomSources] = useState(() => loadStored('jobradar-custom-sources', []));
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiConfigured, setApiConfigured] = useState(null);
  const [jobKeywords, setJobKeywords] = useState(() => new URLSearchParams(window.location.search).get('demo') === 'juriste' ? 'Juriste' : '');
  const [department, setDepartment] = useState('');
  const [jobOffers, setJobOffers] = useState([]);
  const [jobSearchState, setJobSearchState] = useState('idle');
  const [jobSearchError, setJobSearchError] = useState('');
  const [occupations, setOccupations] = useState(loadOccupations);
  const [sourceAudits, setSourceAudits] = useState(() => loadStored('jobradar-source-audits', {}));
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Toutes');
  const [sectorFilter, setSectorFilter] = useState('Tous les secteurs');
  const [occupationModal, setOccupationModal] = useState(false);
  const [sourceModal, setSourceModal] = useState(false);
  const [auditingSource, setAuditingSource] = useState(null);
  const [auditDraft, setAuditDraft] = useState(emptyAudit);
  const [auditWarning, setAuditWarning] = useState('');
  const [newOccupation, setNewOccupation] = useState({ name: '', variants: '', exclusions: '' });
  const [newSource, setNewSource] = useState({ name: '', url: '', category: 'Job board', sector: '' });

  useEffect(() => {
    let cancelled = false;
    async function loadSeeds() {
      try {
        const [employerResponse, platformResponse] = await Promise.all([
          fetch(workbookFiles.employers),
          fetch(workbookFiles.platforms),
        ]);
        if (!employerResponse.ok || !platformResponse.ok) throw new Error('Fichiers Excel introuvables.');
        const [employerBuffer, platformBuffer] = await Promise.all([
          employerResponse.arrayBuffer(),
          platformResponse.arrayBuffer(),
        ]);
        if (cancelled) return;
        setEmployers(parseWorkbook(employerBuffer, 'employers'));
        setPlatforms(parseWorkbook(platformBuffer, 'platforms'));
      } catch {
        if (!cancelled) setLoadError('Les classeurs Excel n’ont pas pu être chargés. Vérifiez qu’ils sont présents à la racine du projet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSeeds();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/status')
      .then((response) => response.json())
      .then((status) => { if (!cancelled) setApiConfigured(Boolean(status.franceTravailConfigured)); })
      .catch(() => { if (!cancelled) setApiConfigured(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => localStorage.setItem('jobradar-occupations', JSON.stringify(occupations)), [occupations]);
  useEffect(() => localStorage.setItem('jobradar-source-audits', JSON.stringify(sourceAudits)), [sourceAudits]);
  useEffect(() => localStorage.setItem('jobradar-custom-sources', JSON.stringify(customSources)), [customSources]);

  const allSources = useMemo(() => [...employers, ...platforms, ...customSources], [employers, platforms, customSources]);
  const auditedCount = allSources.filter((source) => isAuditComplete(sourceAudits[source.id])).length;
  const pilotCount = allSources.filter((source) => sourceAudits[source.id]?.pilot).length;
  const sectors = useMemo(() => [...new Set(allSources.map((item) => item.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [allSources]);
  const filteredSources = useMemo(() => allSources.filter((source) => {
    const matchesSearch = `${source.name} ${source.sector} ${source.description} ${source.location || ''}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'));
    const matchesType = sourceFilter === 'Toutes' || source.kind === sourceFilter;
    const matchesSector = sectorFilter === 'Tous les secteurs' || source.sector === sectorFilter;
    return matchesSearch && matchesType && matchesSector;
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [allSources, search, sourceFilter, sectorFilter]);

  const sectorCounts = useMemo(() => {
    const counts = new Map();
    employers.forEach(({ sector }) => counts.set(sector, (counts.get(sector) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [employers]);

  function openSources() {
    setPage('sources');
    setSearch('');
    setSourceFilter('Toutes');
    setSectorFilter('Tous les secteurs');
  }

  async function searchJobs(event) {
    event.preventDefault();
    setJobSearchState('loading');
    setJobSearchError('');
    setJobOffers([]);
    const params = new URLSearchParams({ keywords: jobKeywords.trim() });
    if (department.trim()) params.set('department', department.trim());
    try {
      const response = await fetch(`/api/jobs?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'La recherche a échoué.');
      setJobOffers(data.offers || []);
      setJobSearchState('success');
    } catch (error) {
      setJobSearchError(error.message || 'Impossible de contacter l’API locale.');
      setJobSearchState('error');
    }
  }

  function addOccupation(event) {
    event.preventDefault();
    const name = newOccupation.name.trim();
    if (!name) return;
    setOccupations((current) => [...current, {
      id: crypto.randomUUID(),
      name,
      variants: newOccupation.variants.split(',').map((item) => item.trim()).filter(Boolean),
      exclusions: newOccupation.exclusions.split(',').map((item) => item.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    }]);
    setNewOccupation({ name: '', variants: '', exclusions: '' });
    setOccupationModal(false);
  }

  function addSource(event) {
    event.preventDefault();
    if (!newSource.name.trim()) return;
    setCustomSources((current) => [...current, {
      id: `custom-${crypto.randomUUID()}`,
      name: newSource.name.trim(),
      url: newSource.url.trim(),
      kind: newSource.category,
      sector: newSource.sector.trim() || 'Non renseigné',
      access: 'À qualifier',
      description: 'Source ajoutée manuellement',
      sourceGroup: '',
    }]);
    setNewSource({ name: '', url: '', category: 'Job board', sector: '' });
    setSourceModal(false);
  }

  function openSourceAudit(source) {
    setAuditingSource(source);
    setAuditDraft({ ...emptyAudit, ...sourceAudits[source.id] });
    setAuditWarning('');
  }

  function saveSourceAudit(event) {
    event.preventDefault();
    if (auditDraft.status === 'Autorisée' && !isAuditComplete(auditDraft)) {
      setAuditWarning('Pour déclarer cette source autorisée, renseignez la méthode et validez les quatre contrôles.');
      return;
    }
    if (auditDraft.pilot && !sourceAudits[auditingSource.id]?.pilot && pilotCount >= 40) {
      setAuditWarning('La sélection pilote est limitée à 40 sources. Retirez d’abord une autre source pilote.');
      return;
    }
    setSourceAudits((current) => ({
      ...current,
      [auditingSource.id]: {
        ...auditDraft,
        pilot: auditDraft.status === 'Autorisée' && auditDraft.pilot,
        updatedAt: new Date().toISOString(),
      },
    }));
    setAuditingSource(null);
  }

  function updateAuditField(field, value) {
    setAuditDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === 'status' && value !== 'Autorisée') next.pilot = false;
      if (!isAuditComplete({ ...next, status: 'Autorisée' })) next.pilot = false;
      return next;
    });
    setAuditWarning('');
  }

  function exportSources() {
    const rows = filteredSources.map(({ name, kind, sector, rawSector, url, location, revenue, employees, access, audience, sourceGroup }) => ({
      Source: name,
      Type: kind,
      Secteur: rawSector || sector,
      URL: url,
      Siege: location || '',
      CA_EUR: revenue || '',
      Effectifs: employees || '',
      Acces: access || '',
      Public: audience || '',
      Groupe: sourceGroup || '',
    }));
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows), { FS: ';' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'jobradar-sources.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const title = page === 'overview' ? 'Votre radar emploi' : page === 'offers' ? 'Offres d’emploi' : page === 'sources' ? 'Registre des sources' : 'Métiers suivis';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <span>jobradar<span className="brand-period">.</span></span>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div className="workspace-copy"><strong>Nova Recrutement</strong><span>Espace de travail</span></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-caption">ESPACE DE TRAVAIL</div>
        <nav className="primary-nav" aria-label="Navigation principale">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${page === id ? 'active' : ''}`} key={id} onClick={() => setPage(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === 'occupations' && occupations.length > 0 && <span className="nav-count">{occupations.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="nav-caption">VOTRE VEILLE</div>
        <div className="watch-empty">
          <div className="watch-empty-icon"><Target size={17} /></div>
          {occupations.length ? (
            <div className="watch-list">{occupations.slice(0, 4).map((occupation) => <button key={occupation.id} onClick={() => setPage('occupations')}>{occupation.name}</button>)}</div>
          ) : <p>Aucun métier suivi pour le moment.</p>}
          <button className="watch-add" onClick={() => setOccupationModal(true)}><Plus size={14} /> Ajouter un métier</button>
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-link" onClick={() => setSourceModal(true)}><Settings2 size={16} /> Ajouter une source</button>
          <div className="account-row"><div className="account-avatar">ML</div><div><strong>Marie Laurent</strong><span>Administratrice</span></div><CircleHelp size={16} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Nova Recrutement</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <div className="system-status"><span className="status-dot" /> Registres locaux</div>
            <button className="icon-button help-button" aria-label="Aide" title="Aide"><CircleHelp size={17} /></button>
            <button className="avatar-button" title="Compte Marie Laurent">ML</button>
          </div>
        </header>

        {loadError && <div className="load-alert"><FileSpreadsheet size={17} />{loadError}</div>}

        {page === 'overview' && (
          <div className="page-content overview-page">
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> JEUDI 23 OCTOBRE 2026</div>
                <h1>Le marché bouge.<br /><span>Gardez une longueur d’avance.</span></h1>
                <p className="welcome-subtitle">Toute votre veille recrutement, réunie au même endroit.</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-ring art-ring-one" /><div className="art-ring art-ring-two" />
                <div className="art-core"><Command size={26} strokeWidth={1.5} /></div>
                <span className="art-node node-one" /><span className="art-node node-two" /><span className="art-node node-three" />
                <span className="art-label">VOTRE MARCHÉ<br />EN MOUVEMENT</span>
              </div>
            </section>

            <section className="metric-strip" aria-label="Indicateurs du registre">
              <div className="metric-item"><div className="metric-label"><Building2 size={15} /> GRANDS GROUPES</div><div className="metric-value">{loading ? '—' : formatNumber(employers.length)}<span> entreprises</span></div><div className="metric-foot">Sites carrières répertoriés</div></div>
              <div className="metric-item"><div className="metric-label"><Globe2 size={15} /> PLATEFORMES</div><div className="metric-value">{loading ? '—' : formatNumber(platforms.length + customSources.length)}<span> sources</span></div><div className="metric-foot">Job boards et agrégateurs</div></div>
              <div className="metric-item metric-accent"><div className="metric-label"><Target size={15} /> MÉTIERS SUIVIS</div><div className="metric-value">{formatNumber(occupations.length)}<span> métiers</span></div><div className="metric-foot">{occupations.length ? 'Prêts à alimenter votre veille' : 'Ajoutez votre premier métier'}</div></div>
              <div className="metric-item"><div className="metric-label"><BriefcaseBusiness size={15} /> OFFRES ACTIVES</div><div className="metric-value">—<span> offres</span></div><div className="metric-foot">Collecte non activée</div></div>
            </section>

            <section className="dashboard-grid">
              <div className="dashboard-panel sector-panel">
                <div className="panel-heading"><div><span className="panel-kicker">VOTRE UNIVERS</span><h2>Employeurs par secteur</h2></div><button className="text-action" onClick={openSources}>Voir le registre <ArrowUpRight size={15} /></button></div>
                {loading ? <div className="panel-loading">Chargement du registre…</div> : (
                  <div className="sector-list">
                    {sectorCounts.map(([sector, count], index) => (
                      <div className="sector-row" key={sector}>
                        <span className={`sector-number sector-number-${index}`}>0{index + 1}</span>
                        <span className="sector-name">{sector}</span>
                        <div className="sector-bar-track"><span style={{ width: `${Math.max(8, (count / (sectorCounts[0]?.[1] || 1)) * 100)}%` }} /></div>
                        <span className="sector-count">{count}</span>
                      </div>
                    ))}
                    {!sectorCounts.length && <div className="panel-loading">Les données sectorielles apparaîtront ici.</div>}
                  </div>
                )}
                <div className="panel-note"><ShieldCheck size={15} /> Taxonomie rapprochée automatiquement depuis le classeur employeurs.</div>
              </div>

              <div className="dashboard-panel tracking-panel">
                <div className="panel-heading"><div><span className="panel-kicker">SUIVI PERSONNALISÉ</span><h2>Vos métiers</h2></div><button className="round-add" aria-label="Ajouter un métier" title="Ajouter un métier" onClick={() => setOccupationModal(true)}><Plus size={18} /></button></div>
                {occupations.length ? (
                  <div className="tracked-list">{occupations.slice(0, 4).map((occupation, index) => <div className="tracked-row" key={occupation.id}><span className={`tracked-icon tracked-icon-${index % 3}`}><Target size={16} /></span><div className="tracked-copy"><strong>{occupation.name}</strong><span>{occupation.variants.length} variante{occupation.variants.length > 1 ? 's' : ''} · En attente de collecte</span></div><span className="tracked-pending">À venir</span></div>)}</div>
                ) : (
                  <div className="empty-tracking"><div className="empty-orbit"><Sparkles size={19} /></div><strong>Votre veille commence ici.</strong><p>Choisissez un métier, puis ajoutez ses synonymes, anglicismes et intitulés alternatifs.</p><button className="button-primary" onClick={() => setOccupationModal(true)}><Plus size={16} /> Suivre un métier</button></div>
                )}
                {occupations.length > 0 && <button className="panel-bottom-action" onClick={() => setPage('occupations')}>Gérer les métiers <ArrowUpRight size={15} /></button>}
              </div>
            </section>

            <section className="source-summary">
              <div className="summary-title"><div><span className="panel-kicker">QUALIFICATION DES SOURCES</span><h2>Prêt pour votre audit</h2></div><span className="audit-pill"><span /> {formatNumber(allSources.length - auditedCount)} à qualifier</span></div>
              <p>Vos registres sont importés. Validez les conditions d’utilisation et les méthodes autorisées avant toute collecte.</p>
              <button className="text-action" onClick={openSources}>Explorer les sources <ArrowUpRight size={15} /></button>
            </section>

            <footer className="page-footer"><span>JOBRADAR <span>·</span> VEILLE RECRUTEMENT</span><span>Données de registre issues des fichiers fournis</span></footer>
          </div>
        )}

        {page === 'offers' && (
          <div className="page-content offers-page">
            <section className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> RECHERCHE EN TEMPS RÉEL</div><h1>Offres d’emploi</h1><p>Résultats publiés par France Travail, sans collecte en arrière-plan.</p></div><span className={`api-state ${apiConfigured ? 'api-ready' : ''}`}><span />{apiConfigured ? 'API configurée' : 'API à configurer'}</span></section>
            <form className="job-search-form" onSubmit={searchJobs}><label><span>Métier ou mots-clés</span><div className="job-input-wrap"><Search size={17} /><input required minLength="2" maxLength="80" value={jobKeywords} onChange={(event) => setJobKeywords(event.target.value)} placeholder="Ex. Juriste" /></div></label><label className="department-field"><span>Département <small>(facultatif)</small></span><div className="job-input-wrap"><MapPin size={16} /><input maxLength="3" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="75, 69, 2A…" /></div></label><button className="button-primary job-search-button" type="submit" disabled={jobSearchState === 'loading'}>{jobSearchState === 'loading' ? <LoaderCircle className="spin-icon" size={16} /> : <Search size={16} />}{jobSearchState === 'loading' ? 'Recherche…' : 'Rechercher'}</button></form>
            {apiConfigured === false && <div className="api-setup-notice"><ShieldCheck size={19} /><div><strong>Connectez votre accès officiel France Travail</strong><p>Ajoutez <code>FRANCE_TRAVAIL_CLIENT_ID</code> et <code>FRANCE_TRAVAIL_CLIENT_SECRET</code> dans votre fichier `.env`, puis redémarrez le serveur avec <code>npm run dev</code>. Les identifiants restent côté serveur.</p></div></div>}
            {apiConfigured && <div className="api-ready-notice"><span className="status-dot" /><span>Connexion au service officiel active. La recherche est déclenchée uniquement à votre demande.</span></div>}
            {jobSearchError && <div className="job-error" role="alert">{jobSearchError}</div>}
            {jobSearchState === 'success' && <div className="offer-results-heading"><div><span className="panel-kicker">RÉSULTATS FRANCE TRAVAIL</span><h2>{jobOffers.length} offre{jobOffers.length > 1 ? 's' : ''} pour « {jobKeywords} »</h2></div><span>Résultats en direct</span></div>}
            {jobOffers.length > 0 && <div className="offer-list">{jobOffers.map((offer, index) => <article className="offer-row" key={offer.id || `${offer.title}-${index}`}><div className="offer-main"><span className="offer-source">FRANCE TRAVAIL · {offer.id || 'OFFRE'}</span><h2>{offer.title}</h2><div className="offer-meta"><span><Building2 size={14} />{offer.company}</span><span><MapPin size={14} />{offer.location}</span><span><BriefcaseBusiness size={14} />{offer.contract}</span>{offer.salary && <span className="offer-salary">{offer.salary}</span>}</div>{offer.description && <p className="offer-description">{offer.description}</p>}<div className="offer-date"><CalendarDays size={13} /> Publiée le {formatJobDate(offer.publishedAt)}</div></div>{offer.url ? <a className="offer-open" href={offer.url} target="_blank" rel="noreferrer" aria-label={`Voir l’annonce ${offer.title}`} title="Voir l’annonce d’origine"><ExternalLink size={17} /></a> : <span className="offer-open disabled" title="Lien source indisponible"><ExternalLink size={17} /></span>}</article>)}</div>}
            {jobSearchState === 'success' && jobOffers.length === 0 && <div className="offers-empty"><div className="empty-orbit"><Search size={19} /></div><h2>Aucune offre trouvée</h2><p>Essaie une autre formulation ou retire le filtre département.</p></div>}
            {jobSearchState === 'idle' && <div className="offers-empty"><div className="empty-orbit"><BriefcaseBusiness size={19} /></div><h2>Les annonces viendront de la source officielle</h2><p>Saisis un métier pour lancer une recherche ponctuelle. Aucune annonce n’est simulée.</p></div>}
            <footer className="page-footer"><span>JOBRADAR <span>·</span> RECHERCHE D’OFFRES</span><span>Données France Travail · affichage ponctuel</span></footer>
          </div>
        )}

        {page === 'sources' && (
          <div className="page-content sources-page">
            <section className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> RÉPERTOIRE CONSOLIDÉ</div><h1>Registre des sources</h1><p>Employeurs et plateformes issus de vos fichiers de départ.</p></div><button className="button-secondary" onClick={exportSources}><ArrowDownToLine size={16} /> Exporter CSV</button></section>
            <section className="source-stats"><div><span>{formatNumber(employers.length)}</span><small>sites carrières</small></div><div><span>{formatNumber(platforms.length + customSources.length)}</span><small>plateformes</small></div><div><span>{formatNumber(auditedCount)}</span><small>autorisées · {pilotCount}/40 pilotes</small></div><button onClick={() => setSourceModal(true)}><Plus size={16} /> Ajouter une source</button></section>
            <section className="registry-panel">
              <div className="registry-toolbar">
                <div className="registry-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une source, un secteur…" aria-label="Rechercher une source" />{search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche"><X size={15} /></button>}</div>
                <div className="filter-group"><SlidersHorizontal size={16} /><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filtrer par type"><option>Toutes</option><option>Site carrière</option><option>Job board</option><option>Agrégateur</option><option>API publique</option></select><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} aria-label="Filtrer par secteur"><option>Tous les secteurs</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></div>
              </div>
              <div className="results-line"><span><strong>{formatNumber(filteredSources.length)}</strong> sources affichées</span><span><Filter size={13} /> Triées par nom</span></div>
              <div className="table-scroll"><table className="source-table"><thead><tr><th>Source</th><th>Type</th><th>Secteur / catégorie</th><th>Accès déclaré</th><th>Groupe</th><th>Audit</th></tr></thead><tbody>
                {filteredSources.slice(0, 300).map((source) => {
                  const audit = { ...emptyAudit, ...sourceAudits[source.id] };
                  const audited = isAuditComplete(audit);
                  return <tr key={source.id}>
                    <td><div className="source-name-cell"><span className={`source-type-icon ${source.kind === 'Site carrière' ? 'employer-icon' : source.kind === 'Agrégateur' ? 'aggregator-icon' : 'board-icon'}`}>{source.kind === 'Site carrière' ? <Building2 size={16} /> : <Globe2 size={16} />}</span><div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer"><strong>{source.name}</strong><ExternalLink size={11} /></a> : <strong>{source.name}</strong>}<span>{source.location || source.audience || source.url || 'URL non renseignée'}</span></div></div></td>
                    <td><span className={`type-badge ${source.kind === 'Site carrière' ? 'type-employer' : source.kind === 'Agrégateur' ? 'type-aggregator' : 'type-board'}`}>{source.kind}</span></td>
                    <td><span className="sector-cell">{source.sector}</span>{source.revenue && <small className="sector-detail">CA {formatRevenue(source.revenue)}</small>}</td>
                    <td><span className="access-cell">{source.access}</span></td>
                    <td>{source.sourceGroup ? <span className="group-pill">{source.sourceGroup}</span> : <span className="muted-dash">—</span>}</td>
                    <td><button className={`audit-open-button ${audited ? 'approved' : ''}`} onClick={() => openSourceAudit(source)} title={`Ouvrir la fiche d’audit de ${source.name}`}><ShieldCheck size={14} /><span>{audit.status}</span><ChevronDown size={12} /></button>{audit.pilot && <small className="pilot-label">Source pilote</small>}</td>
                  </tr>;
                })}
                {loading && <tr><td colSpan="6" className="table-empty">Chargement des fichiers Excel…</td></tr>}
                {!loading && filteredSources.length === 0 && <tr><td colSpan="6" className="table-empty">Aucune source ne correspond à votre recherche.</td></tr>}
              </tbody></table></div>
              <div className="registry-footnote"><ShieldCheck size={15} /><span>Une source n’est autorisée qu’après vérification documentée des CGU, de robots.txt, de sa méthode d’accès et des données personnelles. Cette fiche ne constitue pas un avis juridique ; aucune collecte n’est activée.</span></div>
            </section>
            <footer className="page-footer"><span>JOBRADAR <span>·</span> RÉGISTRE SOURCES</span><span>{filteredSources.length} résultats</span></footer>
          </div>
        )}

        {page === 'occupations' && (
          <div className="page-content occupations-page">
            <section className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> MATCHING LINGUISTIQUE</div><h1>Métiers suivis</h1><p>Un métier, plusieurs intitulés. Construisez votre vocabulaire de veille.</p></div><button className="button-primary" onClick={() => setOccupationModal(true)}><Plus size={16} /> Ajouter un métier</button></section>
            <div className="occupation-intro"><div className="intro-icon"><Sparkles size={19} /></div><div><strong>Les variantes améliorent la couverture.</strong><p>Ajoutez les synonymes, anglicismes, abréviations ou intitulés maison qui désignent le même métier. Les exclusions écartent les faux amis.</p></div></div>
            {occupations.length ? <div className="occupation-list">{occupations.map((occupation) => <article className="occupation-row" key={occupation.id}><div className="occupation-icon"><Target size={19} /></div><div className="occupation-main"><div className="occupation-title"><h2>{occupation.name}</h2><span className="occupation-state">{occupation.demo ? 'Exemple' : 'Prêt à suivre'}</span></div><div className="variant-list">{occupation.variants.length ? occupation.variants.map((variant) => <span key={variant}>{variant}</span>) : <span className="variant-placeholder">Aucune variante ajoutée</span>}</div>{occupation.exclusions.length > 0 && <div className="exclusion-line"><span>EXCLUSIONS</span>{occupation.exclusions.join(' · ')}</div>}</div><button className="icon-button remove-occupation" title={`Supprimer ${occupation.name}`} aria-label={`Supprimer ${occupation.name}`} onClick={() => setOccupations((current) => current.filter(({ id }) => id !== occupation.id))}><X size={17} /></button></article>)}</div> : <div className="occupation-empty"><div className="empty-orbit"><Target size={21} /></div><h2>Aucun métier suivi pour l’instant</h2><p>Créez un métier canonique et ses variantes pour préparer votre première veille.</p><button className="button-primary" onClick={() => setOccupationModal(true)}><Plus size={16} /> Créer un métier</button></div>}
            <div className="local-storage-note"><ShieldCheck size={15} /> Vos métiers sont enregistrés dans ce navigateur. Le matching sera disponible avec les premières offres collectées.</div>
            <footer className="page-footer"><span>JOBRADAR <span>·</span> MÉTIERS & VARIANTES</span><span>{occupations.length} métier{occupations.length > 1 ? 's' : ''} configuré{occupations.length > 1 ? 's' : ''}</span></footer>
          </div>
        )}
      </main>

      {occupationModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOccupationModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="occupation-modal-title"><div className="modal-header"><div><span className="panel-kicker">NOUVEAU SUIVI</span><h2 id="occupation-modal-title">Ajouter un métier</h2></div><button className="icon-button" onClick={() => setOccupationModal(false)} aria-label="Fermer"><X size={18} /></button></div><form onSubmit={addOccupation}><label>Intitulé canonique<input autoFocus required value={newOccupation.name} onChange={(event) => setNewOccupation({ ...newOccupation, name: event.target.value })} placeholder="Ex. Développeur logiciel" /></label><label>Variantes <span>(séparées par des virgules)</span><textarea value={newOccupation.variants} onChange={(event) => setNewOccupation({ ...newOccupation, variants: event.target.value })} placeholder="software engineer, ingénieur logiciel, dev" rows="3" /></label><label>Exclusions <span>(facultatif)</span><input value={newOccupation.exclusions} onChange={(event) => setNewOccupation({ ...newOccupation, exclusions: event.target.value })} placeholder="développeur immobilier" /></label><div className="modal-actions"><button type="button" className="button-plain" onClick={() => setOccupationModal(false)}>Annuler</button><button type="submit" className="button-primary"><Plus size={16} /> Créer le métier</button></div></form></section></div>}

      {auditingSource && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuditingSource(null)}><section className="modal audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title"><div className="modal-header"><div><span className="panel-kicker">QUALIFICATION DE SOURCE</span><h2 id="audit-modal-title">{auditingSource.name}</h2><p className="audit-source-url">{auditingSource.url || 'URL non renseignée'}</p></div><button className="icon-button" onClick={() => setAuditingSource(null)} aria-label="Fermer"><X size={18} /></button></div><form onSubmit={saveSourceAudit}><div className="form-row"><label>Décision<select value={auditDraft.status} onChange={(event) => updateAuditField('status', event.target.value)}><option>À examiner</option><option>Autorisée</option><option>Interdite</option></select></label><label>Méthode de collecte<select value={auditDraft.method} onChange={(event) => updateAuditField('method', event.target.value)}><option value="">À déterminer</option>{auditMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div><div className="form-row"><label>Priorité<select value={auditDraft.priority} onChange={(event) => updateAuditField('priority', event.target.value)}><option>Haute</option><option>Normale</option><option>Basse</option></select></label><label>Fréquence envisagée<select value={auditDraft.frequency} onChange={(event) => updateAuditField('frequency', event.target.value)}><option>Toutes les 6 heures</option><option>Quotidienne</option><option>Hebdomadaire</option><option>Manuelle</option></select></label></div><fieldset className="audit-checklist"><legend>Vérifications effectuées</legend><label><input type="checkbox" checked={auditDraft.termsReviewed} onChange={(event) => updateAuditField('termsReviewed', event.target.checked)} /><span>Conditions d’utilisation examinées</span></label><label><input type="checkbox" checked={auditDraft.robotsReviewed} onChange={(event) => updateAuditField('robotsReviewed', event.target.checked)} /><span>robots.txt vérifié</span></label><label><input type="checkbox" checked={auditDraft.methodVerified} onChange={(event) => updateAuditField('methodVerified', event.target.checked)} /><span>Méthode d’accès vérifiée et permise</span></label><label><input type="checkbox" checked={auditDraft.privacyReviewed} onChange={(event) => updateAuditField('privacyReviewed', event.target.checked)} /><span>Données personnelles et conservation examinées</span></label></fieldset><label>Notes et références<textarea value={auditDraft.notes} onChange={(event) => updateAuditField('notes', event.target.value)} placeholder="Lien vers les CGU, contact partenaire, limites de débit, date de vérification…" rows="3" /></label><label className={`pilot-choice ${auditDraft.status !== 'Autorisée' || !isAuditComplete(auditDraft) ? 'disabled' : ''}`}><input type="checkbox" checked={auditDraft.pilot} disabled={auditDraft.status !== 'Autorisée' || !isAuditComplete(auditDraft)} onChange={(event) => updateAuditField('pilot', event.target.checked)} /><span><strong>Inclure dans les sources pilotes</strong><small>Maximum 40 sources. Disponible après les quatre vérifications et la décision « Autorisée ».</small></span></label>{auditWarning && <div className="audit-warning" role="alert">{auditWarning}</div>}<div className="modal-compliance"><ShieldCheck size={16} /><span>Cette fiche consigne votre examen, mais ne vaut pas validation juridique. JobRadar ne lance aucune collecte.</span></div><div className="modal-actions"><button type="button" className="button-plain" onClick={() => setAuditingSource(null)}>Annuler</button><button type="submit" className="button-primary"><ShieldCheck size={15} /> Enregistrer l’audit</button></div></form></section></div>}

      {sourceModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSourceModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title"><div className="modal-header"><div><span className="panel-kicker">REGISTRE DES SOURCES</span><h2 id="source-modal-title">Ajouter une source</h2></div><button className="icon-button" onClick={() => setSourceModal(false)} aria-label="Fermer"><X size={18} /></button></div><form onSubmit={addSource}><label>Nom de la source<input autoFocus required value={newSource.name} onChange={(event) => setNewSource({ ...newSource, name: event.target.value })} placeholder="Ex. Carrières Exemple" /></label><label>URL<input type="url" value={newSource.url} onChange={(event) => setNewSource({ ...newSource, url: event.target.value })} placeholder="https://" /></label><div className="form-row"><label>Type<select value={newSource.category} onChange={(event) => setNewSource({ ...newSource, category: event.target.value })}><option>Job board</option><option>Agrégateur</option><option>API publique</option><option>Site carrière</option></select></label><label>Secteur<input value={newSource.sector} onChange={(event) => setNewSource({ ...newSource, sector: event.target.value })} placeholder="Ex. Technologie" /></label></div><div className="modal-compliance"><ShieldCheck size={16} /><span>La source sera ajoutée au registre en attente d’audit. Aucune collecte ne sera lancée.</span></div><div className="modal-actions"><button type="button" className="button-plain" onClick={() => setSourceModal(false)}>Annuler</button><button type="submit" className="button-primary"><Plus size={16} /> Ajouter au registre</button></div></form></section></div>}
    </div>
  );
}

export default App;
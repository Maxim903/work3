import http from 'node:http';
import 'dotenv/config';

const port = Number(process.env.API_PORT || 8000);
const tokenUrl = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const offersUrl = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
let cachedToken;

function respond(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'api_offresdemploiv2 o2dsoffre',
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error('Authentification France Travail refusée. Vérifiez les identifiants et le scope API.');
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(Number(token.expires_in || 3600) - 60, 60) * 1000,
  };
  return cachedToken.value;
}

function mapOffer(offer) {
  return {
    id: offer.id,
    title: offer.intitule || 'Intitulé non renseigné',
    company: offer.entreprise?.nom || 'Employeur non renseigné',
    location: offer.lieuTravail?.libelle || 'Lieu non renseigné',
    contract: offer.typeContratLibelle || offer.typeContrat || 'Contrat non renseigné',
    publishedAt: offer.dateCreation || null,
    description: offer.description || '',
    salary: offer.salaire?.libelle || '',
    url: offer.origineOffre?.urlOrigine || '',
    source: 'France Travail',
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/api/status') {
    return respond(response, 200, { franceTravailConfigured: Boolean(clientId && clientSecret) });
  }
  if (request.method !== 'GET' || url.pathname !== '/api/jobs') {
    return respond(response, 404, { error: 'Route introuvable.' });
  }
  if (!clientId || !clientSecret) {
    return respond(response, 503, { error: 'France Travail n’est pas configuré. Ajoutez les identifiants API dans le fichier .env local.' });
  }

  const keywords = (url.searchParams.get('keywords') || '').trim();
  const department = (url.searchParams.get('department') || '').trim().toUpperCase();
  if (keywords.length < 2 || keywords.length > 80) {
    return respond(response, 400, { error: 'Saisissez un métier ou des mots-clés (2 à 80 caractères).' });
  }
  if (department && !/^(\d{2,3}|2A|2B)$/.test(department)) {
    return respond(response, 400, { error: 'Le département doit être un code français valide, par exemple 75 ou 2A.' });
  }

  try {
    const token = await getAccessToken();
    const searchUrl = new URL(offersUrl);
    searchUrl.searchParams.set('motsCles', keywords);
    searchUrl.searchParams.set('range', '0-9');
    if (department) searchUrl.searchParams.set('departement', department);
    const apiResponse = await fetch(searchUrl, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!apiResponse.ok) {
      return respond(response, 502, { error: `L’API France Travail a répondu avec le statut ${apiResponse.status}.` });
    }
    const data = await apiResponse.json();
    const offers = Array.isArray(data) ? data : (data.resultats || data.offres || []);
    return respond(response, 200, { source: 'France Travail', count: offers.length, offers: offers.map(mapOffer) });
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'L’API France Travail ne répond pas dans le délai prévu.'
      : error.message || 'La recherche d’offres a échoué.';
    return respond(response, 502, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`JobRadar API locale prête sur http://127.0.0.1:${port}`);
});
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8000);
const UPSTREAM_URL = process.env.TOFUEL_UPSTREAM_URL || '';
const configuredTimeout = Number(process.env.TOFUEL_TIMEOUT_MS);
const UPSTREAM_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout >= 250 && configuredTimeout <= 30000 ? configuredTimeout : 5000;
const configuredStale = Number(process.env.TOFUEL_STALE_AFTER_MS);
const STALE_AFTER_MS = Number.isFinite(configuredStale) && configuredStale >= 60000 && configuredStale <= 7 * 24 * 60 * 60 * 1000 ? configuredStale : 6 * 60 * 60 * 1000;
const ROOT = path.join(__dirname, 'src');
const SOURCE_NAME = 'tofuel.ru';
const EKATERINBURG_BOUNDS = { minLat: 56.7, maxLat: 57.0, minLon: 60.4, maxLon: 60.8 };

const DEMO_DATA = {
  updatedAt: '2026-09-13T12:42:00+05:00', timestamp: new Date().toISOString(), fetched_at: null,
  source: 'demo', status: 'demo', stale: true, reason: 'TOFUEL_UPSTREAM_URL is not configured', stations: [
    { id: 'demo-1', name: 'Газпромнефть №42', brand: 'ГПН', district: 'Центральный', address: 'ул. Московская, 281', distanceKm: 1.4, lat: 56.8219, lon: 60.5964, updatedAt: '2026-09-13T12:42:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.2, availability: 'unknown' }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.8, availability: 'unknown' }, { fuel: 'ДТ', label: 'ДТ', price: 68.4, availability: 'unknown' }] },
    { id: 'demo-2', name: 'ЛУКОЙЛ №101', brand: 'ЛУК', district: 'Верх-Исетский', address: 'ул. Репина, 94', distanceKm: 2.8, lat: 56.8297, lon: 60.5669, updatedAt: '2026-09-13T12:35:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.9, availability: 'unknown' }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.5, availability: 'unknown' }, { fuel: 'ДТ', label: 'ДТ', price: 67.9, availability: 'unknown' }] }
  ]
};

let lastGoodData = null;

function rememberGoodData(data) { lastGoodData = data; return data; }

function normalizeAvailability(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['available', 'есть', 'in_stock', 'ok'].includes(normalized)) return 'available';
  if (['disputed', 'спорно', 'под вопросом', 'limited', 'queue', 'очередь', 'мало'].includes(normalized)) return 'disputed';
  if (['unavailable', 'нет', 'out_of_stock'].includes(normalized)) return 'unavailable';
  return 'unknown';
}

function stationList(payload) {
  if (Array.isArray(payload?.stations)) return payload.stations;
  if (Array.isArray(payload?.data?.stations)) return payload.data.stations;
  if (Array.isArray(payload?.data)) return payload.data;
  return null;
}

function normalizeUpstream(payload, now = Date.now()) {
  const stations = stationList(payload);
  if (!stations?.length) return null;
  const normalized = stations.map((station, index) => {
    const coordinates = station.coordinates || {};
    const lat = Number(station.lat ?? station.latitude ?? coordinates.latitude);
    const lon = Number(station.lon ?? station.lng ?? station.longitude ?? coordinates.longitude);
    const prices = (station.fuels || station.prices || []).map((fuel) => ({
      fuel: fuel.fuel_type || fuel.fuel || fuel.type || fuel.name,
      label: fuel.fuel_type || fuel.label || fuel.fuel || fuel.type || fuel.name,
      price: Number(fuel.price_rub ?? fuel.price ?? fuel.value),
      availability: normalizeAvailability(fuel.availability ?? fuel.status ?? station.availability),
      confidence: fuel.confidence ?? null,
      probability: fuel.probability ?? null,
      lastReportAt: fuel.last_report_at || fuel.lastReportAt || null
    })).filter((fuel) => fuel.fuel && Number.isFinite(fuel.price));
    return {
      id: String(station.id ?? `station-${index}`), name: station.name || station.title || station.brand || 'АЗС',
      brand: station.brand || station.network || 'АЗС', district: station.district || station.area || 'Екатеринбург',
      address: station.address || station.addr || 'Адрес не указан', distanceKm: Number(station.distanceKm ?? station.distance ?? 0),
      lat, lon, updatedAt: station.last_update || station.updatedAt || station.updated_at || new Date(now).toISOString(),
      operationalStatus: station.operational_status || station.status_badge || null, verified: station.verified ?? null,
      rating: station.rating ?? null, dispensingLimits: station.dispensing_limits || null, prices
    };
  }).filter((station) => station.name && station.address && Number.isFinite(station.lat) && Number.isFinite(station.lon)
    && station.lat >= EKATERINBURG_BOUNDS.minLat && station.lat <= EKATERINBURG_BOUNDS.maxLat
    && station.lon >= EKATERINBURG_BOUNDS.minLon && station.lon <= EKATERINBURG_BOUNDS.maxLon && station.prices.length);
  if (!normalized.length) return null;
  const candidateTimestamp = payload.last_update || payload.updatedAt || payload.timestamp || normalized[0].updatedAt;
  const parsed = Date.parse(candidateTimestamp);
  const updatedAt = Number.isNaN(parsed) ? new Date(now).toISOString() : new Date(parsed).toISOString();
  const stale = Number.isNaN(parsed) || now - parsed > STALE_AFTER_MS;
  return { updatedAt, timestamp: new Date(now).toISOString(), fetched_at: new Date(now).toISOString(), source: SOURCE_NAME, status: stale ? 'stale' : 'live', stale, stations: normalized };
}

function fallbackData(reason, status = 'error') {
  if (lastGoodData) return { ...lastGoodData, timestamp: new Date().toISOString(), status, reason, stale: status !== 'live' || lastGoodData.stale };
  return { ...DEMO_DATA, timestamp: new Date().toISOString(), status, reason };
}

async function fetchUpstream() {
  if (!UPSTREAM_URL) return fallbackData('TOFUEL_UPSTREAM_URL is not configured', 'demo');
  let upstream;
  try { upstream = new URL(UPSTREAM_URL); } catch (_) { return fallbackData('TOFUEL_UPSTREAM_URL is invalid'); }
  if (upstream.hostname === 'tofuel.ru' && upstream.pathname.startsWith('/api/')) return fallbackData('tofuel.ru robots.txt disallows /api/ server-side access');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, { headers: { Accept: 'application/json', 'User-Agent': 'Fuelwatch-EKB/1.0' }, signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return fallbackData(`Upstream returned HTTP ${response.status} or non-JSON content`);
    const data = normalizeUpstream(await response.json());
    if (!data) return fallbackData('Upstream JSON had no valid Ekaterinburg stations');
    return rememberGoodData(data);
  } catch (_) { return fallbackData('Upstream request timed out or was unavailable'); } finally { clearTimeout(timer); }
}

function sendJson(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); response.end(JSON.stringify(body)); }
function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const file = path.resolve(ROOT, `.${requested}`);
  if (!file.startsWith(ROOT)) return sendJson(response, 404, { error: 'Not found' });
  fs.readFile(file, (error, content) => { if (error) return sendJson(response, 404, { error: 'Not found' }); const extension = path.extname(file); const type = extension === '.css' ? 'text/css; charset=utf-8' : extension === '.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'; response.writeHead(200, { 'Content-Type': type }); response.end(content); });
}
const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url?.split('?')[0] === '/api/fuel-prices.json') return sendJson(response, 200, await fetchUpstream());
  if (request.method === 'GET') return serveStatic(request, response);
  sendJson(response, 405, { error: 'Method not allowed' });
});
if (require.main === module) server.listen(PORT, () => console.log(`Fuelwatch EKB listening on http://localhost:${PORT}`));
module.exports = { DEMO_DATA, EKATERINBURG_BOUNDS, normalizeAvailability, normalizeUpstream, fallbackData, fetchUpstream, rememberGoodData };

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8000);
const UPSTREAM_URL = process.env.GDEBENZ_UPSTREAM_URL || '';
const configuredTimeout = Number(process.env.GDEBENZ_TIMEOUT_MS);
const UPSTREAM_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout >= 250 && configuredTimeout <= 30000 ? configuredTimeout : 5000;
const ROOT = path.join(__dirname, 'src');

const DEMO_DATA = { updatedAt: '2026-09-13T12:42:00+05:00', timestamp: new Date().toISOString(), source: 'demo', status: 'demo', stale: true, reason: 'GDEBENZ_UPSTREAM_URL is not configured', stations: [
  { name: 'Газпромнефть №42', brand: 'ГПН', district: 'Центральный', address: 'ул. Московская, 281', distanceKm: 1.4, lat: 56.8219, lon: 60.5964, updatedAt: '2026-09-13T12:42:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.2 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.8 }, { fuel: 'ДТ', label: 'ДТ', price: 68.4 }] },
  { name: 'ЛУКОЙЛ №101', brand: 'ЛУК', district: 'Верх-Исетский', address: 'ул. Репина, 94', distanceKm: 2.8, lat: 56.8297, lon: 60.5669, updatedAt: '2026-09-13T12:35:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.9 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.5 }, { fuel: 'ДТ', label: 'ДТ', price: 67.9 }] },
  { name: 'Башнефть', brand: 'БН', district: 'Октябрьский', address: 'ул. Восточная, 160', distanceKm: 3.1, lat: 56.8324, lon: 60.6413, updatedAt: '2026-09-13T12:31:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.4 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.2 }, { fuel: 'ДТ', label: 'ДТ', price: 68.1 }] },
  { name: 'Газпромнефть №18', brand: 'ГПН', district: 'Кировский', address: 'ул. Сулимова, 50', distanceKm: 4.6, lat: 56.8601, lon: 60.6325, updatedAt: '2026-09-13T12:27:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.1 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.7 }, { fuel: 'ДТ', label: 'ДТ', price: 68.3 }] },
  { name: 'Татнефть', brand: 'ТН', district: 'Чкаловский', address: 'ул. Щорса, 128', distanceKm: 5.2, lat: 56.8014, lon: 60.6202, updatedAt: '2026-09-13T12:18:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.7 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.1 }, { fuel: 'ДТ', label: 'ДТ', price: 67.8 }] },
  { name: 'Нефтегаз', brand: 'НГ', district: 'Железнодорожный', address: 'ул. Бебеля, 17', distanceKm: 6.4, lat: 56.8628, lon: 60.5576, updatedAt: '2026-09-13T12:11:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.0 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.4 }, { fuel: 'ДТ', label: 'ДТ', price: 68.0 }] }
] };

function normalizeUpstream(payload) {
  const stations = payload?.stations || payload?.data?.stations || payload?.data;
  if (!Array.isArray(stations) || !stations.length) return null;
  const normalizeAvailability = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (['available', 'есть', 'in_stock', 'ok'].includes(normalized)) return 'available';
    if (['queue', 'очередь', 'limited', 'мало'].includes(normalized)) return 'limited';
    if (['unavailable', 'нет', 'out_of_stock'].includes(normalized)) return 'unavailable';
    return 'unknown';
  };
  const normalized = stations.map((station) => ({
    name: station.name || station.title || station.brand || 'АЗС', brand: station.brand || station.network || 'АЗС',
    district: station.district || station.area || 'Екатеринбург', address: station.address || station.addr || 'Адрес не указан',
    distanceKm: Number(station.distanceKm ?? station.distance ?? 0), lat: Number(station.lat ?? station.latitude), lon: Number(station.lon ?? station.lng ?? station.longitude),
    updatedAt: station.updatedAt || station.updated_at || new Date().toISOString(),
    prices: (station.prices || station.fuels || []).map((price) => ({ fuel: price.fuel || price.type || price.name, label: price.label || price.fuel || price.type || price.name, price: Number(price.price ?? price.value), availability: normalizeAvailability(price.availability || price.status || station.availability) })).filter((price) => price.fuel && Number.isFinite(price.price))
  })).filter((station) => station.name && station.address && station.prices.length);
  const candidateTimestamp = payload.updatedAt || payload.timestamp;
  const updatedAt = Number.isNaN(Date.parse(candidateTimestamp)) ? new Date().toISOString() : new Date(candidateTimestamp).toISOString();
  const stale = Number.isNaN(Date.parse(updatedAt)) || Date.now() - Date.parse(updatedAt) > 6 * 60 * 60 * 1000;
  return normalized.length ? { updatedAt, timestamp: new Date().toISOString(), source: 'gdebenz', status: stale ? 'stale' : 'live', stale, stations: normalized } : null;
}

function fallbackData(reason, status = 'error') { return { ...DEMO_DATA, timestamp: new Date().toISOString(), status, reason }; }
async function fetchUpstream() {
  if (!UPSTREAM_URL) return fallbackData('GDEBENZ_UPSTREAM_URL is not configured', 'demo');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(UPSTREAM_URL, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return fallbackData(`Upstream returned HTTP ${response.status} or non-JSON content`);
    return normalizeUpstream(await response.json()) || fallbackData('Upstream JSON shape was not recognized');
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
module.exports = { DEMO_DATA, normalizeUpstream };

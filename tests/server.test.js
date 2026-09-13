const assert = require('node:assert/strict');
const test = require('node:test');
const { EKATERINBURG_BOUNDS, normalizeAvailability, normalizeUpstream, fallbackData, rememberGoodData } = require('../server');

const fixture = {
  last_update: '2026-09-13T14:00:00+05:00',
  stations: [
    { id: 42, name: 'Tofuel EKB', brand: 'Тест', address: 'ул. Тестовая, 1', coordinates: { latitude: 56.84, longitude: 60.61 }, fuels: [{ fuel_type: 'АИ-95', availability: 'available', price_rub: 61.2, confidence: 0.9, last_report_at: '2026-09-13T13:55:00Z' }] },
    { id: 43, name: 'Out of region', brand: 'Тест', address: 'Другой регион', coordinates: { latitude: 55.75, longitude: 37.61 }, fuels: [{ fuel_type: 'АИ-95', availability: 'available', price_rub: 60 }] },
    { id: 44, name: 'No price', brand: 'Тест', address: 'Без цены', coordinates: { latitude: 56.85, longitude: 60.62 }, fuels: [{ fuel_type: 'АИ-95', availability: 'unknown' }] }
  ]
};

test('normalizes tofuel station and fuel fields', () => {
  const result = normalizeUpstream(fixture, Date.parse('2026-09-13T14:01:00+05:00'));
  assert.equal(result.source, 'tofuel.ru');
  assert.equal(result.status, 'live');
  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].id, '42');
  assert.equal(result.stations[0].prices[0].price, 61.2);
  assert.equal(result.stations[0].prices[0].availability, 'available');
  assert.equal(result.stations[0].prices[0].confidence, 0.9);
});

test('filters coordinates to the Ekaterinburg bounding box', () => {
  const result = normalizeUpstream(fixture);
  assert.ok(result.stations.every((station) => station.lat >= EKATERINBURG_BOUNDS.minLat && station.lat <= EKATERINBURG_BOUNDS.maxLat));
  assert.ok(result.stations.every((station) => station.lon >= EKATERINBURG_BOUNDS.minLon && station.lon <= EKATERINBURG_BOUNDS.maxLon));
});

test('maps observed availability values without collapsing disputed state', () => {
  assert.equal(normalizeAvailability('available'), 'available');
  assert.equal(normalizeAvailability('disputed'), 'disputed');
  assert.equal(normalizeAvailability('unavailable'), 'unavailable');
  assert.equal(normalizeAvailability('unexpected'), 'unknown');
});

test('marks old payloads stale and rejects empty or malformed payloads', () => {
  const result = normalizeUpstream({ ...fixture, last_update: '2020-01-01T00:00:00Z' });
  assert.equal(result.status, 'stale');
  assert.equal(normalizeUpstream({ stations: [] }), null);
  assert.equal(normalizeUpstream({ html: '<body>blocked</body>' }), null);
});

test('fallback preserves last good station data on upstream failure', () => {
  const good = normalizeUpstream(fixture);
  rememberGoodData(good);
  const response = fallbackData('bad upstream');
  assert.equal(response.source, 'tofuel.ru');
  assert.equal(response.status, 'error');
  assert.equal(response.stations[0].id, '42');
  assert.equal(good.stations[0].prices[0].availability, 'available');
});

console.log('server normalization checks passed');

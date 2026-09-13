const API_ENDPOINT = '/api/fuel-prices.json';

const DEMO_DATA = {
  updatedAt: '2026-09-13T12:42:00+05:00',
  source: 'demo', status: 'demo', stale: true, stations: [
    { name: 'Газпромнефть №42', brand: 'ГПН', district: 'Центральный', address: 'ул. Московская, 281', distanceKm: 1.4, lat: 56.8219, lon: 60.5964, updatedAt: '2026-09-13T12:42:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.2 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.8 }, { fuel: 'ДТ', label: 'ДТ', price: 68.4 }] },
    { name: 'ЛУКОЙЛ №101', brand: 'ЛУК', district: 'Верх-Исетский', address: 'ул. Репина, 94', distanceKm: 2.8, lat: 56.8297, lon: 60.5669, updatedAt: '2026-09-13T12:35:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.9 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.5 }, { fuel: 'ДТ', label: 'ДТ', price: 67.9 }] },
    { name: 'Башнефть', brand: 'БН', district: 'Октябрьский', address: 'ул. Восточная, 160', distanceKm: 3.1, lat: 56.8324, lon: 60.6413, updatedAt: '2026-09-13T12:31:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.4 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.2 }, { fuel: 'ДТ', label: 'ДТ', price: 68.1 }] },
    { name: 'Газпромнефть №18', brand: 'ГПН', district: 'Кировский', address: 'ул. Сулимова, 50', distanceKm: 4.6, lat: 56.8601, lon: 60.6325, updatedAt: '2026-09-13T12:27:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.1 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.7 }, { fuel: 'ДТ', label: 'ДТ', price: 68.3 }] },
    { name: 'Татнефть', brand: 'ТН', district: 'Чкаловский', address: 'ул. Щорса, 128', distanceKm: 5.2, lat: 56.8014, lon: 60.6202, updatedAt: '2026-09-13T12:18:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.7 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.1 }, { fuel: 'ДТ', label: 'ДТ', price: 67.8 }] },
    { name: 'Нефтегаз', brand: 'НГ', district: 'Железнодорожный', address: 'ул. Бебеля, 17', distanceKm: 6.4, lat: 56.8628, lon: 60.5576, updatedAt: '2026-09-13T12:11:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.0 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.4 }, { fuel: 'ДТ', label: 'ДТ', price: 68.0 }] }
  ]
};

const state = { data: null, lastGoodData: null, fuel: 'all', district: 'all', sort: 'price', query: '' };
const REFRESH_MS = 5 * 60 * 1000;
const $ = (selector) => document.querySelector(selector);
const priceFormat = (value) => value.toFixed(1).replace('.', ',');
const timeFormat = (value) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
let map;
const mapMarkers = [];

function isValidData(data) {
  return data && Array.isArray(data.stations) && data.stations.length > 0 && data.stations.every((station) => station.name && station.address && Number.isFinite(station.lat) && Number.isFinite(station.lon) && Array.isArray(station.prices) && station.prices.length > 0);
}

async function loadData() {
  showState('loading');
  try {
    const response = await fetch(API_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API responded ${response.status}`);
    const apiData = await response.json();
    if (!isValidData(apiData)) throw new Error('API response has an invalid shape');
    state.data = apiData;
    if (apiData.status === 'live' || apiData.status === 'stale') state.lastGoodData = apiData;
  } catch (error) {
    state.data = state.lastGoodData
      ? { ...state.lastGoodData, status: 'error', stale: true, reason: 'API недоступен; показаны последние подтвержденные данные' }
      : { ...DEMO_DATA, status: 'error', stale: true, reason: 'API недоступен; показаны демонстрационные данные' };
  }
  setupDistricts();
  renderSummary();
  renderStations();
  $('#updated-at').textContent = `Синхронизация ${timeFormat(state.data.fetched_at || state.data.timestamp || state.data.updatedAt)}`;
  const statusLabels = { live: 'LIVE · данные upstream', stale: 'STALE · источник устарел', demo: 'DEMO · нет подтвержденного upstream', error: state.lastGoodData ? 'ERROR · последний подтвержденный кэш' : 'ERROR · используются demo-данные' };
  const status = state.data.status || 'demo';
  $('#data-status').textContent = `${statusLabels[status] || status} · ${state.data.reason || `получено ${timeFormat(state.data.timestamp || state.data.updatedAt)}`}`;
  $('#data-status').className = `data-status data-status-${status}`;
  $('#data-source').textContent = `Источник: ${state.data.source || 'unknown'} · статус: ${status}${state.data.fetched_at ? ` · ${timeFormat(state.data.fetched_at)}` : ''}`;
}

function showState(name) {
  ['loading', 'error', 'empty'].forEach((stateName) => { $(`#${stateName}-state`).hidden = stateName !== name; });
  $('.table-head').hidden = name !== null;
  $('#station-list').hidden = name !== null;
}

function setupDistricts() {
  const select = $('#district-select');
  const districts = [...new Set(state.data.stations.map((station) => station.district))].sort();
  select.innerHTML = '<option value="all">Все районы</option>' + districts.map((district) => `<option value="${district}">${district}</option>`).join('');
}

function getPrice(station) {
  const item = state.fuel === 'all' ? station.prices[0] : station.prices.find((price) => price.fuel === state.fuel);
  return item || station.prices[0];
}

function filteredStations() {
  return state.data.stations.filter((station) => {
    const haystack = `${station.name} ${station.district} ${station.address}`.toLowerCase();
    return (state.district === 'all' || station.district === state.district) && haystack.includes(state.query.toLowerCase()) && (state.fuel === 'all' || station.prices.some((price) => price.fuel === state.fuel));
  }).sort((a, b) => {
    if (state.sort === 'distance') return a.distanceKm - b.distanceKm;
    if (state.sort === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
    return getPrice(a).price - getPrice(b).price;
  });
}

function renderSummary() {
  const all92 = state.data.stations.flatMap((station) => station.prices.filter((price) => price.fuel === 'АИ-92').map((price) => price.price));
  const all95 = state.data.stations.flatMap((station) => station.prices.filter((price) => price.fuel === 'АИ-95'));
  const lowest = all95.reduce((min, item) => item.price < min.price ? item : min, all95[0]);
  const lowestStation = lowest && state.data.stations.find((station) => station.prices.includes(lowest));
  $('#avg-price').textContent = all92.length ? priceFormat(all92.reduce((sum, price) => sum + price, 0) / all92.length) : '—';
  $('#low-price').textContent = lowest ? priceFormat(lowest.price) : '—';
  $('#low-price-station').textContent = lowestStation?.name || 'Нет данных';
  $('#station-count').textContent = state.data.stations.length;
}

function renderStations() {
  const stations = filteredStations();
  if (!stations.length) { showState('empty'); return; }
  showState(null);
  $('#station-list').innerHTML = stations.map((station) => {
    const price = getPrice(station);
    return `<article class="station-row"><div class="station-main"><span class="station-logo">${escapeHtml(station.brand)}</span><div><div class="station-name">${escapeHtml(station.name)}</div><div class="station-address">${escapeHtml(station.address)}</div></div></div><div class="district">${escapeHtml(station.district)}</div><div class="distance">${Number(station.distanceKm || 0).toFixed(1).replace('.', ',')} км</div><div class="price-stack"><strong class="price">${priceFormat(price.price)} ₽</strong><span class="fuel-tag">${escapeHtml(price.label)}</span><span class="availability availability-${escapeHtml(price.availability || 'unknown')}">${escapeHtml(price.availability || 'unknown')}</span></div><div class="updated">${timeFormat(station.updatedAt)}</div></article>`;
  }).join('');
  renderMap();
}

function renderMap() {
  if (!window.L || !state.data) return;
  if (!map) {
    map = L.map('fuel-map', { scrollWheelZoom: false }).setView([56.8389, 60.6057], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map);
  }
  mapMarkers.splice(0).forEach((marker) => marker.remove());
  filteredStations().forEach((station) => {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) return;
    const price = getPrice(station);
    const marker = L.circleMarker([station.lat, station.lon], { radius: 8, color: '#073d34', weight: 2, fillColor: '#b6ef70', fillOpacity: 1 }).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong><br>${escapeHtml(station.address)}<br>${priceFormat(price.price)} ₽ · ${escapeHtml(price.label)}<br>Наличие: ${escapeHtml(price.availability || 'unknown')}<br>Обновлено: ${timeFormat(station.updatedAt)}`);
    mapMarkers.push(marker);
  });
}

function clearFilters() { state.fuel = 'all'; state.district = 'all'; state.sort = 'price'; state.query = ''; document.querySelectorAll('.filter-button').forEach((button) => button.classList.toggle('active', button.dataset.fuel === 'all')); $('#district-select').value = 'all'; $('#sort-select').value = 'price'; $('#search-input').value = ''; renderStations(); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => { state.fuel = button.dataset.fuel; document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('active', item === button)); renderStations(); }));
  $('#district-select').addEventListener('change', (event) => { state.district = event.target.value; renderStations(); });
  $('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; renderStations(); });
  $('#search-input').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderStations(); });
  $('#clear-button').addEventListener('click', clearFilters);
  $('#retry-button').addEventListener('click', loadData);
  $('#refresh-button').addEventListener('click', loadData);
  loadData();
  window.setInterval(loadData, REFRESH_MS);
});

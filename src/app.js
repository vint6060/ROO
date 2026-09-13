const API_ENDPOINT = '/api/fuel-prices.json';

const DEMO_DATA = {
  updatedAt: '2026-09-13T12:42:00+05:00',
  stations: [
    { name: 'Газпромнефть №42', brand: 'ГПН', district: 'Центральный', address: 'ул. Московская, 281', distanceKm: 1.4, updatedAt: '2026-09-13T12:42:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.2 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.8 }, { fuel: 'ДТ', label: 'ДТ', price: 68.4 }] },
    { name: 'ЛУКОЙЛ №101', brand: 'ЛУК', district: 'Верх-Исетский', address: 'ул. Репина, 94', distanceKm: 2.8, updatedAt: '2026-09-13T12:35:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.9 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.5 }, { fuel: 'ДТ', label: 'ДТ', price: 67.9 }] },
    { name: 'Башнефть', brand: 'БН', district: 'Октябрьский', address: 'ул. Восточная, 160', distanceKm: 3.1, updatedAt: '2026-09-13T12:31:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.4 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.2 }, { fuel: 'ДТ', label: 'ДТ', price: 68.1 }] },
    { name: 'Газпромнефть №18', brand: 'ГПН', district: 'Кировский', address: 'ул. Сулимова, 50', distanceKm: 4.6, updatedAt: '2026-09-13T12:27:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.1 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.7 }, { fuel: 'ДТ', label: 'ДТ', price: 68.3 }] },
    { name: 'Татнефть', brand: 'ТН', district: 'Чкаловский', address: 'ул. Щорса, 128', distanceKm: 5.2, updatedAt: '2026-09-13T12:18:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 53.7 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.1 }, { fuel: 'ДТ', label: 'ДТ', price: 67.8 }] },
    { name: 'Нефтегаз', brand: 'НГ', district: 'Железнодорожный', address: 'ул. Бебеля, 17', distanceKm: 6.4, updatedAt: '2026-09-13T12:11:00+05:00', prices: [{ fuel: 'АИ-92', label: 'АИ-92', price: 54.0 }, { fuel: 'АИ-95', label: 'АИ-95', price: 59.4 }, { fuel: 'ДТ', label: 'ДТ', price: 68.0 }] }
  ]
};

const state = { data: null, fuel: 'all', district: 'all', sort: 'price', query: '' };
const $ = (selector) => document.querySelector(selector);
const priceFormat = (value) => value.toFixed(1).replace('.', ',');
const timeFormat = (value) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function isValidData(data) {
  return data && Array.isArray(data.stations) && data.stations.length > 0 && data.stations.every((station) => station.name && station.district && station.address && Array.isArray(station.prices) && station.prices.length > 0);
}

async function loadData() {
  showState('loading');
  try {
    const response = await fetch(API_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API responded ${response.status}`);
    const apiData = await response.json();
    if (!isValidData(apiData)) throw new Error('API response has an invalid shape');
    state.data = apiData;
  } catch (error) {
    // The static demo remains usable without a backend. No credentials are needed.
    state.data = DEMO_DATA;
  }
  setupDistricts();
  renderSummary();
  renderStations();
  $('#updated-at').textContent = `Обновлено сегодня в ${timeFormat(state.data.updatedAt)}`;
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
  const all92 = state.data.stations.map((station) => station.prices.find((price) => price.fuel === 'АИ-92').price);
  const all95 = state.data.stations.flatMap((station) => station.prices.filter((price) => price.fuel === 'АИ-95'));
  const lowest = all95.reduce((min, item) => item.price < min.price ? item : min, all95[0]);
  const lowestStation = state.data.stations.find((station) => station.prices.includes(lowest));
  $('#avg-price').textContent = priceFormat(all92.reduce((sum, price) => sum + price, 0) / all92.length);
  $('#low-price').textContent = priceFormat(lowest.price);
  $('#low-price-station').textContent = lowestStation.name;
  $('#station-count').textContent = state.data.stations.length;
}

function renderStations() {
  const stations = filteredStations();
  if (!stations.length) { showState('empty'); return; }
  showState(null);
  $('#station-list').innerHTML = stations.map((station) => {
    const price = getPrice(station);
    return `<article class="station-row"><div class="station-main"><span class="station-logo">${escapeHtml(station.brand)}</span><div><div class="station-name">${escapeHtml(station.name)}</div><div class="station-address">${escapeHtml(station.address)}</div></div></div><div class="district">${escapeHtml(station.district)}</div><div class="distance">${station.distanceKm.toFixed(1).replace('.', ',')} км</div><div class="price-stack"><strong class="price">${priceFormat(price.price)} ₽</strong><span class="fuel-tag">${escapeHtml(price.label)}</span></div><div class="updated">${timeFormat(station.updatedAt)}</div></article>`;
  }).join('');
}

function clearFilters() { state.fuel = 'all'; state.district = 'all'; state.sort = 'price'; state.query = ''; document.querySelectorAll('.filter-button').forEach((button) => button.classList.toggle('active', button.dataset.fuel === 'all')); $('#district-select').value = 'all'; $('#sort-select').value = 'price'; $('#search-input').value = ''; renderStations(); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => { state.fuel = button.dataset.fuel; document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('active', item === button)); renderStations(); }));
  $('#district-select').addEventListener('change', (event) => { state.district = event.target.value; renderStations(); });
  $('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; renderStations(); });
  $('#search-input').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderStations(); });
  $('#clear-button').addEventListener('click', clearFilters);
  $('#retry-button').addEventListener('click', loadData);
  loadData();
});

# Fuelwatch EKB

Адаптивная статическая панель мониторинга цен на бензин на АЗС Екатеринбурга.
Проект работает без сборщика. Карта использует Leaflet и тайлы OpenStreetMap через CDN.

## Запуск

Для полноценного запуска (статические файлы + proxy API) нужен Node.js 18+:

```bash
node server.js
```

Затем откройте <http://localhost:8000>.

## Данные и API

Клиент запрашивает относительный endpoint `/api/fuel-prices.json`. Сервер пытается
получить JSON с URL из `GDEBENZ_UPSTREAM_URL`, ограничивает запрос таймаутом
`GDEBENZ_TIMEOUT_MS` (по умолчанию 5000 мс), проверяет content type и форму данных.
Если URL не задан, upstream недоступен, отвечает не-JSON или имеет неизвестную
структуру, сервер возвращает встроенный demo-набор. Ключи и секреты не нужны.

Пример настройки (URL должен быть предоставлен/разрешён оператором gdebenz.ru):

```bash
GDEBENZ_UPSTREAM_URL='https://gdebenz.ru/<documented-json-endpoint>' GDEBENZ_TIMEOUT_MS=5000 node server.js
```

Публичная страница `https://gdebenz.ru/` сама по себе является HTML-приложением,
а не стабильным документированным JSON API. Проект намеренно не угадывает
внутренний endpoint и не парсит HTML.

```json
{
  "updatedAt": "2026-09-13T12:00:00Z",
  "timestamp": "2026-09-13T12:00:01Z",
  "source": "gdebenz",
  "status": "live",
  "stale": false,
  "stations": []
}
```

Каждая АЗС содержит `name`, `brand`, `district`, `address`, `distanceKm`,
`updatedAt` и массив `prices` с полями `fuel`, `label`, `price`, `availability`.
`status` бывает `live`, `stale`, `demo` или `error`; UI не называет demo-значения
актуальными и показывает этот статус рядом со списком.

## Проверки

```bash
node --check src/app.js
git diff --check
```

Данные gdebenz.ru — пользовательские отметки, а не официальная котировка; доступность,
CORS, структура и условия upstream могут измениться. Leaflet/OpenStreetMap требуют
сетевого доступа к CDN и тайлам; без него список и demo fallback продолжают работать,
но карта может быть пустой.

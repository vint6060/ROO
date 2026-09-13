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

Клиент запрашивает относительный endpoint `/api/fuel-prices.json`. Сервер принимает
JSON-источник в `TOFUEL_UPSTREAM_URL`, ограничивает запрос таймаутом
`TOFUEL_TIMEOUT_MS` (по умолчанию 5000 мс), проверяет content type, форму данных и
координаты Екатеринбургской зоны. `TOFUEL_STALE_AFTER_MS` задаёт порог устаревания
(по умолчанию 6 часов). Если источник не задан, недоступен, отвечает не-JSON или
имеет неизвестную структуру, сервер не затирает последний валидный кэш.

Пример настройки (URL должен быть предоставлен/разрешён оператором gdebenz.ru):

```bash
TOFUEL_UPSTREAM_URL='https://<permitted-json-source>/<endpoint>' TOFUEL_TIMEOUT_MS=5000 node server.js
```

У tofuel.ru внутренние `/api/stations/cluster` и `/api/stations/nearby` доступны
с JSON-ответом, но `robots.txt` содержит `Disallow: /api/`, поэтому приложение
не вызывает эти маршруты по умолчанию и не обходит это ограничение. Подключайте
только разрешённый оператором JSON-источник через переменную окружения.

```json
{
  "updatedAt": "2026-09-13T12:00:00Z",
  "timestamp": "2026-09-13T12:00:01Z",
  "source": "tofuel.ru",
  "status": "live",
  "stale": false,
  "stations": []
}
```

Каждая АЗС содержит `id`, `name`, `brand`, `address`, `lat`, `lon`, `updatedAt`
и массив `prices` с полями `fuel`, `label`, `price`, `availability`, а также
доступные метаданные уверенности. Состояние доступности сохраняется как
`available`, `disputed`, `unavailable` или `unknown`.
`status` бывает `live`, `stale`, `demo` или `error`; UI не называет demo-значения
актуальными и показывает этот статус рядом со списком.

## Проверки

```bash
node --check server.js
node --check src/app.js
node --test
git diff --check
```

Данные gdebenz.ru — пользовательские отметки, а не официальная котировка; доступность,
CORS, структура и условия upstream могут измениться. Leaflet/OpenStreetMap требуют
сетевого доступа к CDN и тайлам; без него список и demo fallback продолжают работать,
но карта может быть пустой.

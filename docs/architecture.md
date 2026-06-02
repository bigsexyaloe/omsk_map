# Архитектура проекта

## Интерактивная карта: Заводы Омска времён Великой Отечественной войны

---

## 1. Обзор архитектуры

Проект построен по лёгкой микросервисной архитектуре с двумя основными сервисами:

1. **Frontend-сервис (Nginx)** — раздаёт статические файлы (HTML, CSS, JS, изображения) и проксирует API-запросы к бэкенду.
2. **Backend-сервис (FastAPI)** — предоставляет REST API для получения данных о заводах на карте.

Оба сервиса запускаются как отдельные Docker-контейнеры и управляются через Docker Compose.

### Диаграмма архитектуры

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Браузер   │ ───→ │    Nginx     │ ───→ │   FastAPI    │
│  (Leaflet / │      │  (порт 8080) │      │  (порт 8000) │
│   OSM)      │      │              │      │              │
└─────────────┘      │  /api/* →   │      │  GET /api/   │
                     │  FastAPI    │      │    places    │
                     │  /* → ста-  │      │              │
                     │   тика      │      │  ┌──────────┐│
                     └──────────────┘      │ │places.json││
                                            │ └──────────┘│
                                            └──────────────┘
```

### Поток данных (User → Frontend → Backend)

```
User clicks on a map pin (factory)
       │
       ▼
Browser (JavaScript) determines place ID from the pin
       │
       ▼
JS finds factory data from pre-loaded JSON (from /api/places)
       │
       ▼
JS updates sidebar: image, title, description
```

---

## 2. Компоненты системы

### 2.1. Frontend (Nginx + Static Files)

**Роль:** Клиентский интерфейс пользователя.
**Технологии:** HTML5, CSS3, Vanilla JS, Leaflet + OpenStreetMap.

**Структура:**
```
frontend/
├── index.html          # Главная и единственная страница
├── css/
│   └── style.css       # Стили страницы
├── js/
│   └── app.js          # Вся клиентская логика
└── assets/
    └── images/         # Изображения заводов
```

**Ключевые функции `app.js`:**
1. Инициализация карты Leaflet с тайлами OpenStreetMap.
2. Загрузка данных с `/api/places`.
3. Нанесение меток заводов на карту.
4. Обработка клика по метке — обновление сайдбара.
5. Fallback-логика при недоступности API.

**Веб-сервер:** Nginx выполняет две задачи:
- Раздаёт статические файлы (корень `frontend/`).
- Проксирует запросы `/api/` на backend (http://backend:8000).

**Конфигурация Nginx:**
```nginx
server {
    listen 8080;
    server_name localhost;

    # Статика
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }

    # API прокси
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2.2. Backend (FastAPI)

**Роль:** Предоставляет данные о заводах.
**Технологии:** Python 3.11+, FastAPI, Uvicorn.

**Структура:**
```
backend/
├── main.py             # Точка входа FastAPI
├── data/
│   └── places.json     # Статичные данные о 6 заводах
└── requirements.txt    # Зависимости
```

**API Endpoints:**

| Метод | Путь          | Описание                             |
|-------|---------------|--------------------------------------|
| GET   | /api/places   | Возвращает полный список заводов (JSON) |
| GET   | /api/places/{id} | Возвращает один завод по ID        |
| GET   | /health       | Проверка работоспособности сервиса   |

**Пример ответа `GET /api/places`:**
```json
[
  {
    "id": 1,
    "title": "Завод № 173 (Омский завод транспортного машиностроения, «Трансмаш»)",
    "description": "Создан на базе эвакуированных Ворошиловградского, Конотопского, Брянского и Ленинградского заводов. Стал заводом танковой промышленности № 174, выпускавшим танки. В годы войны предприятие сыграло ключевую роль в обеспечении фронта бронетехникой.",
    "coordinates": [54.937277, 73.288909],
    "image": "zavod-173.jpg"
  },
  {
    "id": 2,
    "title": "Омский шинный завод",
    "description": "Эвакуирован из Ленинграда и уже в январе 1942 года выдал первую серийную продукцию. Стал единственным крупным производителем автопокрышек в восточных регионах СССР, снабжая армию.",
    "coordinates": [54.958999, 73.435783],
    "image": "shinny-zavod.jpg"
  }
]
```

**Логика `main.py`:**
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI(title="Omsk Map API")

# Разрешаем CORS от Nginx
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_places():
    with open("data/places.json", "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/places")
def get_places():
    return load_places()

@app.get("/api/places/{place_id}")
def get_place(place_id: int):
    places = load_places()
    for place in places:
        if place["id"] == place_id:
            return place
    raise HTTPException(404, "Place not found")

@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## 3. Данные проекта

### Перечень заводов на карте (6 точек)

| ID | Название | Координаты | Изображение |
|----|----------|------------|-------------|
| 1 | Завод № 173 («Трансмаш») | 54.937277, 73.288909 | zavod-173.jpg |
| 2 | Омский шинный завод | 54.958999, 73.435783 | shinny-zavod.jpg |
| 3 | Завод № 166 (ПО «Полёт») | 54.955624, 73.413810 | zavod-166.jpg |
| 4 | Омский завод электротехнической аппаратуры (№ 634) | 55.068893, 73.293034 | zavod-634.jpg |
| 5 | Завод им. Козицкого | 54.996459, 73.376998 | zavod-kozickogo.jpg |
| 6 | Сибзавод им. Куйбышева | 55.001267, 73.350928 | sibzavod.jpg |

---

## 4. Docker-инфраструктура

### docker-compose.yml

```yaml
version: "3.9"

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "8080:8080"
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend/data:/app/data  # Для удобного обновления JSON
```

### Dockerfile.frontend
```dockerfile
FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/ /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### Dockerfile.backend
```dockerfile
FROM python:3.11-alpine
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Сетевое взаимодействие

### Внутренняя сеть Docker

- Контейнеры общаются через внутреннюю Docker-сеть.
- Frontend (Nginx) → backend (FastAPI) по имени хоста `backend:8000`.
- Внешний порт: 8080 (только Nginx доступен снаружи).

### Внешние API

- Leaflet (CDN unpkg.com) загружается браузером — бесплатный open-source.
- OpenStreetMap тайлы — бесплатные, без API-ключа.
- Принцип Leaflet: `L.map()` + `L.tileLayer('https://{s}.tile.openstreetmap.org/...')`.

---

## 6. Управление данными

### Формат хранения

Единственный источник данных — файл `backend/data/places.json`.

### Процесс обновления данных

1. Разработчик редактирует `places.json` (добавляет/изменяет/удаляет заводы).
2. При необходимости добавляет изображение в `frontend/assets/images/`.
3. Перезапускает контейнеры: `docker-compose up --build`.

### Ограничения

- Одновременное редактирование JSON не предусмотрено (один разработчик).
- Конфликтов при записи не возникает, т.к. файл читается, а не пишется через API.
- Рекомендуется использовать `volume` для `backend/data` (как в docker-compose.yml) — это позволяет обновлять JSON без пересборки образа.

---

## 7. Обработка ошибок и fallback

### Сценарии

| Ситуация                           | Действие                                     |
|------------------------------------|----------------------------------------------|
| Backend не отвечает                | Фронтенд использует встроенный fallback JSON |
| Изображение не найдено             | Отображается placeholder                     |
| Некорректный JSON в places.json    | Backend возвращает 500, фронтенд — fallback  |
| Leaflet/OSM не загрузился          | Показывается сообщение об ошибке             |

### Fallback на фронтенде

```javascript
// app.js
async function loadPlaces() {
    try {
        const response = await fetch('/api/places');
        if (!response.ok) throw new Error('API error');
        return await response.json();
    } catch (error) {
        console.warn('API unavailable, using fallback data');
        return FALLBACK_PLACES; // минимальный набор данных (минимум 1–2 завода)
    }
}
```

---

## 8. Зависимости

### Frontend
- Leaflet (CDN unpkg.com) — библиотека для интерактивных карт (open-source, MIT license).
- OpenStreetMap тайлы — бесплатный источник картографических данных.
- Никаких npm-пакетов.

### Backend
- `fastapi` — веб-фреймворк.
- `uvicorn` — ASGI-сервер.
- Больше никаких зависимостей.

### Инфраструктура
- Docker Engine 20.10+
- Docker Compose 2.x+ (или Docker Desktop с Compose V2)

---

## 9. Развёртывание

### Локальная разработка

```bash
# Клонировать репозиторий
git clone <repo> && cd omsk_map

# Запустить все сервисы
docker-compose up --build

# Открыть в браузере
open http://localhost:8080
```

### Продакшен / VPS

```bash
# Скопировать файлы на сервер
scp -r ./omsk_map user@server:/opt/omsk_map

# Запустить
cd /opt/omsk_map && docker-compose up -d --build

# Сервис будет доступен на порту 8080
# Рекомендуется настроить reverse proxy (например, Caddy или Nginx) 
# на порту 443 с Let's Encrypt для HTTPS
```

---

## 10. Масштабирование

При текущей нагрузке (50–100 пользователей/день, 6 точек на карте) архитектура избыточна и не требует масштабирования.

**При росте нагрузки можно:**
1. Добавить кэширование на уровне Nginx (кэш для `/api/places`).
2. Заменить JSON-файл на in-memory кэш (редко меняющиеся данные).
3. Добавить реплики backend-контейнера и балансировку через Nginx.

**При усложнении функционала:**
1. Заменить JSON на SQLite / PostgreSQL.
2. Добавить админ-панель для управления точками.
3. Внедрить CDN для изображений.

---

## 11. Принципы разработки (AI-assisted)

Проект разрабатывается с активным использованием AI-инструментов.

### Рекомендации для эффективной AI-assisted разработки:

1. **Контекст в prompt'ах:**
   - Всегда указывайте файл, который нужно изменить.
   - Прилагайте архитектурные ограничения (нет БД, статика, Docker).
   - Сообщайте AI стиль кода (Vanilla JS, без фреймворков).
   - Указывайте тематику (заводы Омска времён ВОВ, 6 точек).

2. **Итеративный подход:**
   - Сначала создавайте скелет (html → css → js → backend → docker).
   - Запускайте и проверяйте после каждого шага.
   - AI хорошо справляется с шаблонным кодом — делегируйте рутину.

3. **Code review:**
   - Каждый сгенерированный AI блок кода проверяется человеком.
   - Особое внимание: API-ключи, CORS, безопасность, корректность координат.
   - Проверяйте осмысленность исторических описаний заводов.

4. **Типовые промпты:**
   - _"Создай index.html с картой Leaflet слева и сайдбаром справа"_
   - _"Напиши main.py FastAPI, который читает places.json и отдаёт по /api/places"_
   - _"Создай nginx.conf для раздачи статики и прокси /api на backend"_
   - _"Напиши app.js: инициализация карты, загрузка заводов с API, клик-обработчик"_
   - _"Оберни сервисы в Docker Compose"_

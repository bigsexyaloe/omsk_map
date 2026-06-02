# Омск в годы Великой Отечественной войны — Интерактивная карта

Интерактивная карта заводов Омска, эвакуированных в 1941–1945 гг.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | HTML + JS (Leaflet), статический |
| Бэкенд | FastAPI (Python 3.11, Alpine), Docker |
| База данных | PostgreSQL 17 (точки, добавленные через `/add`) |
| Старые точки | `backend/data/places.json` (7 заводов, hardcoded) |

## Структура

```
omsk_map/
├── backend/
│   ├── main.py              # FastAPI: GET/POST/DELETE + auth + upload
│   ├── requirements.txt     # fastapi, uvicorn, psycopg2-binary, python-multipart
│   ├── schema.sql           # Миграция PostgreSQL (places_new)
│   └── data/
│       ├── places.json      # Старые 7 точек (исходные данные)
│       └── uploads/         # Загруженные фото (volume mount)
├── frontend/
│   ├── index.html           # Карта (Leaflet + сайдбар + галерея)
│   ├── add.html             # Форма добавления точки (миникарта + загрузка фото)
│   ├── delete.html          # Удаление точек из БД
│   ├── js/app.js            # Логика карты, галерея, getImageSrc()
│   ├── css/style.css
│   └── assets/images/       # Фото старых 7 заводов
├── Dockerfile.backend       # Сборка бэкенда
└── docs/                    # Архитектура, техспецификация
```

## API

### GET /api/places
Возвращает все точки: 7 старых (из JSON) + новые (из БД).

```json
[
  {"id": 1, "title": "Завод № 173", "coordinates": [54.93, 73.28], "images": [{"src": "21.jpg", "description": ""}]},
  {"id": 8, "title": "Новый завод", "coordinates": [54.99, 73.40], "images": [{"src": "/uploads/abc.jpg"}], "source": "new"}
]
```

### POST /api/places
Добавляет новую точку. Требует HTTP Basic Auth (логин: ``, пароль: ``).  
Поля формы: `title`, `description`, `latitude`, `longitude`, `files` (multipart).

### GET /api/places/new
Список новых точек из БД. Требует авторизацию.

### DELETE /api/places/{id}
Удаляет точку и файлы фото. Требует авторизацию.

## Аутентификация

HTTP Basic Auth: ` : ` (переменная окружения `ADD_PASSWORD`).

## Деплой

Frontend → статические файлы в `/var/www/doblestnaroda.ru/` (Nginx на хосте).  
Backend → Docker-контейнер `omsk-backend`, `--network host`, `PG_HOST=127.0.0.1`.  
Photos → хостовый volume `/opt/doblestnaroda/backend/data/` → `/app/data/`.  
Фронтенд обновляется через CI/CD (GitHub Actions).

```bash
# Клонировать
git clone https://github.com/bigsexyaloe/omsk_map.git

# Backend
cd backend
docker build -t omsk-backend -f ../Dockerfile.backend .
docker run -d --name omsk-backend --restart unless-stopped --network host \
  -v /opt/doblestnaroda/backend/data:/app/data \
  -e PG_HOST=127.0.0.1 -e PG_PASSWORD=change_me_app_password \
  omsk-backend

# Frontend (требуется infra-репозиторий для Nginx конфига)
scp -r frontend/* root@89.108.76.149:/var/www/doblestnaroda.ru/

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
import json
import os
import secrets
import shutil
import psycopg2
import psycopg2.extras
from pathlib import Path

app = FastAPI(title="Omsk Map API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Database config ===
PG_HOST = os.environ.get("PG_HOST", "127.0.0.1")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_USER = os.environ.get("PG_USER", "app_user")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "change_me_app_password")
PG_DB = os.environ.get("PG_DB", "omsk_map")

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/data/uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# Mount uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# === Auth ===
security = HTTPBasic()
ADD_PASSWORD = os.environ.get("ADD_PASSWORD", "shilnikov")


def verify_password(credentials: HTTPBasicCredentials = Depends(security)):
    correct = secrets.compare_digest(credentials.password.encode("utf-8"), ADD_PASSWORD.encode("utf-8"))
    if not correct:
        raise HTTPException(401, detail="Invalid password")
    return True


# === DB helpers ===
def get_conn():
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        dbname=PG_DB,
    )


# === Helpers ===
def load_places_json():
    """Загрузить старые точки из places.json (7 заводов)"""
    with open("data/places.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_new_places():
    """Загрузить новые точки из БД"""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, title, description, latitude, longitude, images FROM places_new ORDER BY created_at DESC")
            rows = cur.fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        images = row["images"] if isinstance(row["images"], list) else json.loads(row["images"] or "[]")
        result.append({
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "coordinates": [row["latitude"], row["longitude"]],
            "images": images,
            "source": "new",
        })
    return result


# === Routes ===

@app.get("/api/places")
def get_places():
    """Возвращает старые точки (из JSON) + новые (из БД)"""
    old = load_places_json()
    new = load_new_places()
    return old + new


@app.get("/api/places/new")
def get_new_places(credentials: HTTPBasicCredentials = Depends(security)):
    """Список новых точек из БД (требуется пароль)"""
    verify_password(credentials)
    return load_new_places()


@app.get("/api/places/{place_id}")
def get_place(place_id: int):
    new = load_new_places()
    for p in new:
        if p["id"] == place_id:
            return p
    old = load_places_json()
    for p in old:
        if p["id"] == place_id:
            return p
    raise HTTPException(404, "Place not found")


@app.post("/api/places")
def add_place(
    title: str = Form(...),
    description: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    files: list[UploadFile] = File([]),
    _=Depends(verify_password),
):
    """Добавить новую точку (требуется HTTP Basic Auth, пароль: shilnikov)"""
    image_urls = []
    for file in files:
        if file.filename:
            safe_name = f"{secrets.token_hex(8)}_{file.filename}"
            file_path = os.path.join(UPLOAD_DIR, safe_name)
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            image_urls.append({"src": f"/uploads/{safe_name}", "description": ""})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO places_new (title, description, latitude, longitude, images) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (title, description, latitude, longitude, json.dumps(image_urls, ensure_ascii=False)),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    finally:
        conn.close()

    return {"id": new_id, "title": title, "images": image_urls, "status": "created"}


@app.delete("/api/places/{place_id}")
def delete_place(place_id: int, credentials: HTTPBasicCredentials = Depends(security)):
    """Удалить точку из БД (требуется пароль)"""
    verify_password(credentials)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM places_new WHERE id = %s RETURNING id", (place_id,))
            deleted = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    if not deleted:
        raise HTTPException(404, "Place not found or not deletable")

    return {"id": place_id, "status": "deleted"}


@app.get("/health")
def health():
    return {"status": "ok"}

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

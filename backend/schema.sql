-- =============================================================================
-- schema.sql — Миграция для omsk_map
-- Применить: sudo -u postgres psql -d omsk_map -f schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS places_new (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Индекс для быстрого поиска по координатам (bbox-запросы)
CREATE INDEX IF NOT EXISTS idx_places_new_coords
    ON places_new (latitude, longitude);

-- Права для app_user (микросервисы)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
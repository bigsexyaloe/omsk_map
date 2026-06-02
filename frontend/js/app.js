// ============================================================
// Fallback-данные на случай недоступности backend
// ============================================================
const FALLBACK_PLACES = [
    {
        id: 1,
        title: 'Завод № 173 (Омский завод транспортного машиностроения)',
        description: 'Создан на базе эвакуированных заводов.',
        coordinates: [54.937277, 73.288909],
        images: [{ src: '21.jpg', description: '' }]
    },
    {
        id: 2,
        title: 'Омский шинный завод',
        description: 'Эвакуирован из Ленинграда.',
        coordinates: [54.929290, 73.383876],
        images: [{ src: '34.jpg', description: '' }]
    }
];

// ============================================================
// Состояние галереи
// ============================================================
let currentPlace = null;    // Текущий выбранный объект (завод)
let currentIndex = 0;       // Индекс текущего фото в массиве images

// ============================================================
// Вспомогательные функции
// ============================================================

function computeBounds(coords, pad) {
    pad = pad || 0.05;
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    coords.forEach(function (c) {
        if (c[0] < minLat) minLat = c[0];
        if (c[0] > maxLat) maxLat = c[0];
        if (c[1] < minLng) minLng = c[1];
        if (c[1] > maxLng) maxLng = c[1];
    });
    return L.latLngBounds(
        [minLat - pad, minLng - pad],
        [maxLat + pad, maxLng + pad]
    );
}

// ============================================================
// Загрузка данных с API или fallback
// ============================================================
async function loadPlaces() {
    try {
        const response = await fetch('/api/places');
        if (!response.ok) throw new Error('API error');
        return await response.json();
    } catch (error) {
        console.warn('API недоступен, используем fallback-данные');
        return FALLBACK_PLACES;
    }
}

// ============================================================
// Галерея
// ============================================================

function renderGallery(place, index) {
    const images = place.images;
    if (!images || images.length === 0) return;

    const imgEl = document.getElementById('gallery-image');
    const counterEl = document.getElementById('gallery-counter');
    const descEl = document.getElementById('gallery-description');
    const thumbsEl = document.getElementById('gallery-thumbs');
    const prevBtn = document.getElementById('gallery-prev');
    const nextBtn = document.getElementById('gallery-next');

    // Текущее изображение
    const img = images[index];
    if (!img) return;

    imgEl.src = 'assets/images/' + img.src;
    imgEl.onerror = function () {
        this.src = '';
        this.alt = '(нет фото)';
    };

    // Счётчик
    counterEl.textContent = (index + 1) + ' из ' + images.length;

    // Описание
    descEl.textContent = img.description || '';

    // Кнопки навигации
    prevBtn.style.display = images.length > 1 ? '' : 'none';
    nextBtn.style.display = images.length > 1 ? '' : 'none';

    // Миниатюры
    thumbsEl.innerHTML = '';
    images.forEach(function (item, i) {
        const thumb = document.createElement('img');
        thumb.src = 'assets/images/' + item.src;
        thumb.className = 'gallery-thumb' + (i === index ? ' active' : '');
        thumb.title = item.description || '';
        thumb.addEventListener('click', function () {
            openGallery(place, i);
        });
        thumbsEl.appendChild(thumb);
    });
}

function openGallery(place, index) {
    currentPlace = place;
    currentIndex = index;
    renderGallery(place, index);
}

function prevImage() {
    if (!currentPlace || !currentPlace.images) return;
    const total = currentPlace.images.length;
    currentIndex = (currentIndex - 1 + total) % total;
    renderGallery(currentPlace, currentIndex);
}

function nextImage() {
    if (!currentPlace || !currentPlace.images) return;
    const total = currentPlace.images.length;
    currentIndex = (currentIndex + 1) % total;
    renderGallery(currentPlace, currentIndex);
}

// ============================================================
// Показать информацию о месте в сайдбаре
// ============================================================
function showPlace(place) {
    const welcomeEl = document.getElementById('sidebar-welcome');
    const placeEl = document.getElementById('sidebar-place');
    const titleEl = document.getElementById('place-title');
    const descEl = document.getElementById('place-description');

    welcomeEl.classList.add('hidden');
    placeEl.classList.remove('hidden');

    titleEl.textContent = place.title;
    descEl.textContent = place.description;

    // Открываем галерею с первого фото
    openGallery(place, 0);
}

// ============================================================
// Основная функция инициализации
// ============================================================
async function initMap() {
    // Загружаем данные о местах
    const places = await loadPlaces();

    if (places.length === 0) {
        console.warn('Нет данных для отображения на карте');
        document.getElementById('map-container').innerHTML =
            '<div style="padding:40px;text-align:center;color:#a0896e;">' +
            'Нет данных для отображения.</div>';
        return;
    }

    // Извлекаем массив координат
    const coords = places.map(function (p) {
        return [p.coordinates[0], p.coordinates[1]];
    });

    // Вычисляем границы
    const bounds = computeBounds(coords, 0.07);
    const center = bounds.getCenter();

    // Инициализируем карту
    const map = L.map('map-container', {
        center: center,
        zoom: 11,
        zoomControl: true,
        scrollWheelZoom: true,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
    });

    map.setMinZoom(10);
    map.setMaxZoom(16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 18,
    }).addTo(map);

    map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 12,
    });

    // Кастомная иконка
    const redIcon = L.divIcon({
        className: 'custom-marker',
        html: `
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30C40 8.954 31.046 0 20 0z" fill="#b22222"/>
                <circle cx="20" cy="20" r="8" fill="white"/>
            </svg>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50],
    });

    // Добавляем метки
    places.forEach(function (place) {
        const marker = L.marker([place.coordinates[0], place.coordinates[1]], {
            icon: redIcon,
            title: place.title,
        }).addTo(map);

        marker.on('click', function () {
            showPlace(place);
        });
    });
}

// ============================================================
// Навешиваем обработчики навигации галереи
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('gallery-prev').addEventListener('click', prevImage);
    document.getElementById('gallery-next').addEventListener('click', nextImage);

    // Клавиатурная навигация
    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
    });

    initMap();
});

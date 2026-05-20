router.init("trip-detail.html");

const tripId = new URLSearchParams(window.location.search).get("id");
let trip = null;
let map = null;
let mediaList = [];
let mediaIndex = 0;
let editingPlace = null;
let editingEntry = null;
let placeRating = 0;
const RAINVIEWER_API_URL =
  "https://api.rainviewer.com/public/weather-maps.json";
const RAINVIEWER_TILE_SIZE = 512;
const RAINVIEWER_COLOR_SCHEME = 2;
const RAINVIEWER_MAX_ZOOM = 7;

function isMapStyleReady(mapInstance) {
  return typeof mapInstance.isStyleLoaded === "function"
    ? mapInstance.isStyleLoaded()
    : mapInstance.loaded();
}

async function waitForMapStyle(mapInstance) {
  if (isMapStyleReady(mapInstance)) return;

  await new Promise((resolve) => mapInstance.once("load", resolve));
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!tripId) {
    window.location.href = "/trips.html";
    return;
  }

  await loadTrip();
  initTabs();
  bindHeaderActions();

  await loadTabData("map");
});

async function loadTrip() {
  try {
    trip = await api.get(`/api/trips/${tripId}`);
    renderHeader();
    renderStats();
  } catch {
    showToast("Поездка не найдена", "error");
    setTimeout(() => (window.location.href = "/trips.html"), 2000);
  }
}

function renderHeader() {
  document.title = `TravelDiary — ${trip.title}`;
  document.getElementById("tripTitle").textContent = trip.title;

  const statusBadge = document.getElementById("headerStatus");
  statusBadge.textContent = statusLabel(trip.status);
  statusBadge.className = `badge badge-${trip.status.toLowerCase()}`;

  const visBadge = document.getElementById("headerVisibility");
  visBadge.textContent = visibilityLabel(trip.visibility);
  visBadge.className = `badge badge-${trip.visibility === "PUBLIC" ? "public" : "private"}`;

  const parts = [];
  if (trip.city || trip.country)
    parts.push(
      `📍 ${[trip.city, getCountryName(trip.country)].filter(Boolean).join(", ")}`,
    );
  if (trip.startDate)
    parts.push(`📅 ${formatDateRange(trip.startDate, trip.endDate)}`);
  if (trip.budget) parts.push(`💰 ${trip.budget.toLocaleString("ru-RU")} ₽`);

  document.getElementById("tripMeta").innerHTML = parts
    .map((p) => `<span>${p}</span>`)
    .join("");

  if (trip.coverImageUrl) {
    document.querySelector(".trip-header").style.backgroundImage =
      `url(${api.fileUrl(trip.coverImageUrl)})`;
    document.querySelector(".trip-header").style.backgroundSize = "cover";
    document.querySelector(".trip-header").style.backgroundPosition = "center";
  }

  document.getElementById("editBtn").href = `/trip-create.html?id=${tripId}`;
}

function renderStats() {
  document.getElementById("statMedia").textContent = trip.mediaCount || 0;
  document.getElementById("statPlaces").textContent = trip.placesCount || 0;
  document.getElementById("statJournal").textContent =
    trip.journalEntriesCount || 0;

  if (trip.startDate && trip.endDate) {
    const days =
      Math.round(
        (new Date(trip.endDate) - new Date(trip.startDate)) / 86400000,
      ) + 1;
    document.getElementById("statDays").textContent = days;
  } else {
    document.getElementById("statDays").textContent = "—";
  }
}

function initTabs() {
  document.querySelectorAll(".detail-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      const name = tab.dataset.tab;

      document
        .querySelectorAll(".detail-tabs .tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`panel-${name}`)?.classList.add("active");

      await loadTabData(name);
    });
  });
}

async function loadTabData(tab) {
  switch (tab) {
    case "map":
      await initMap();
      break;
    case "media":
      await loadMedia();
      break;
    case "places":
      await loadPlaces();
      break;
    case "journal":
      await loadJournal();
      break;
    case "files":
      await loadTripFiles();
      break;
    case "weather":
      await loadWeather();
      break;
  }
}

async function initMap() {
  if (map) return;

  try {
    const places = await api.get(`/api/trips/${tripId}/places`);
    const withCoords = places.filter((p) => p.latitude && p.longitude);
    const center =
      withCoords.length > 0
        ? [withCoords[0].longitude, withCoords[0].latitude]
        : [37.6173, 55.7558];

    map = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/streets-v2/style.json?key=BijZmsokKMHtIjwtS2cD",
      center: center,
      zoom: 10,
      attributionControl: true,
    });

    await new Promise((resolve) => map.on("load", resolve));

    let pinModeActive = false;
    let pinModeMarker = null;

    const pinBtn = document.getElementById("mapPinModeBtn");
    const pinHint = document.getElementById("mapPinHint");

    if (pinBtn) {
      pinBtn.addEventListener("click", () => {
        pinModeActive = !pinModeActive;
        if (pinModeActive) {
          pinBtn.textContent = "✕ Отменить";
          pinBtn.classList.add("btn-danger");
          pinBtn.classList.remove("btn-secondary");
          pinHint.style.display = "inline";
          map.getCanvas().style.cursor = "crosshair";
        } else {
          exitPinMode();
        }
      });
    }

    function exitPinMode() {
      pinModeActive = false;
      if (pinBtn) {
        pinBtn.textContent = "📍 Поставить метку вручную";
        pinBtn.classList.remove("btn-danger");
        pinBtn.classList.add("btn-secondary");
      }
      if (pinHint) pinHint.style.display = "none";
      map.getCanvas().style.cursor = "";
      if (pinModeMarker) {
        pinModeMarker.remove();
        pinModeMarker = null;
      }
    }

    map.on("click", async (e) => {
      if (!pinModeActive) return;
      const { lng, lat } = e.lngLat;

      if (pinModeMarker) pinModeMarker.remove();

      const el = document.createElement("div");
      el.className = "map-pin-temp";
      el.innerHTML = "📍";
      pinModeMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);

      let address = "";
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru,en`,
          { headers: { "User-Agent": "TravelDiaryApp/1.0" } },
        );
        const data = await resp.json();
        address = data.display_name || "";

        if (address)
          address = address
            .split(",")
            .slice(0, 3)
            .map((s) => s.trim())
            .join(", ");
      } catch {
      }

      openPlaceModal(null);
      document.getElementById("placeAddress").value = address;
      document.getElementById("placeLat").value = lat.toFixed(6);
      document.getElementById("placeLon").value = lng.toFixed(6);

      const badge = document.getElementById("placeCoordsBadge");
      const text = document.getElementById("placeCoordsText");
      if (badge && text) {
        text.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        badge.style.display = "flex";
      }

      exitPinMode();
    });

    const allCoords = [];

    places.forEach((place) => {
      if (!place.latitude || !place.longitude) return;
      const el = document.createElement("div");
      el.className = "map-marker";
      el.innerHTML = `<span>${categoryIcon(place.category)}</span>`;

      const popupHtml = `
        <div style="padding:8px;min-width:160px">
          <div style="font-weight:600;margin-bottom:4px">${escapeHtml(place.name)}</div>
          <div style="font-size:12px;color:#64748b">${categoryLabel(place.category)}</div>
          ${place.rating ? `<div style="margin-top:4px;color:#f59e0b">${"★".repeat(place.rating)}</div>` : ""}
          ${place.note ? `<div style="font-size:12px;margin-top:4px;font-style:italic">${escapeHtml(place.note)}</div>` : ""}
        </div>`;

      new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupHtml))
        .addTo(map);

      allCoords.push([place.longitude, place.latitude]);
    });

    try {
      const gpsMedia = await api.get(`/api/trips/${tripId}/media/map`);
      gpsMedia.forEach((media) => {
        if (!media.exifLatitude || !media.exifLongitude) return;

        const el = document.createElement("div");
        el.className = "map-media-marker";
        el.style.backgroundImage = `url(${api.fileUrl(media.thumbnailUrl || media.fileUrl)})`;

        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([media.exifLongitude, media.exifLatitude])
          .addTo(map);

        allCoords.push([media.exifLongitude, media.exifLatitude]);
      });
    } catch {
    }

    if (allCoords.length > 1) {
      const lngs = allCoords.map((c) => c[0]);
      const lats = allCoords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 14 },
      );
    } else if (allCoords.length === 1) {
      map.setCenter(allCoords[0]);
      map.setZoom(13);
    }
  } catch (err) {
    console.error("Map error:", err);
    document.getElementById("map").innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8">Ошибка загрузки карты</div>';
  }

  let tripRadarActive = false;
  document
    .getElementById("tripToggleRadarBtn")
    ?.addEventListener("click", async (e) => {
      if (!map) return;
      const btn = e.target;

      if (tripRadarActive) {
        if (map.getLayer("trip-radar")) map.removeLayer("trip-radar");
        if (map.getSource("trip-radar")) map.removeSource("trip-radar");
        tripRadarActive = false;
        btn.innerHTML = "🌧 Показать радар";
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
        return;
      }

      btn.innerHTML = "⌛ Загрузка...";
      btn.classList.add("loading");
      btn.disabled = true;

      try {
        await waitForMapStyle(map);

        const rawRes = await fetch(RAINVIEWER_API_URL);
        const data = await rawRes.json();
        const pastFrames = data?.radar?.past || [];
        const latestPast = pastFrames[pastFrames.length - 1];

        if (!data?.host || !latestPast?.path) {
          const statusInfo = rawRes.ok ? "" : ` (HTTP ${rawRes.status})`;
          throw new Error(
            `RainViewer API response has no radar frames${statusInfo}`,
          );
        }

        const tileUrl = `${data.host}${latestPast.path}/${RAINVIEWER_TILE_SIZE}/{z}/{x}/{y}/${RAINVIEWER_COLOR_SCHEME}/1_1.png`;

        map.addSource("trip-radar", {
          type: "raster",
          tiles: [tileUrl],
          tileSize: RAINVIEWER_TILE_SIZE,
          maxzoom: RAINVIEWER_MAX_ZOOM,
        });
        map.addLayer({
          id: "trip-radar",
          type: "raster",
          source: "trip-radar",
          paint: {
            "raster-opacity": 0.7,
            "raster-resampling": "linear",
          },
        });

        tripRadarActive = true;
        btn.innerHTML = "☀️ Скрыть радар";
        btn.classList.remove("btn-secondary");
        btn.classList.add("btn-primary");
      } catch (err) {
        if (map.getLayer("trip-radar")) map.removeLayer("trip-radar");
        if (map.getSource("trip-radar")) map.removeSource("trip-radar");
        tripRadarActive = false;
        console.error("Radar load error:", err);
        showToast("Не удалось загрузить данные радара", "error");
        btn.innerHTML = "🌧 Показать радар";
      } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
      }
    });
}

async function loadMedia() {
  try {
    mediaList = await api.get(`/api/trips/${tripId}/media`);
    renderMediaGrid();
  } catch (err) {
    showToast("Ошибка загрузки медиа: " + err.message, "error");
  }
}

function isVideo(media) {
  return media.contentType && media.contentType.startsWith("video/");
}

function renderMediaGrid() {
  const grid = document.getElementById("mediaGrid");

  if (mediaList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">🖼️</span>
        <p class="empty-state__title">Галерея пуста</p>
        <p class="empty-state__text">Загрузите фото или видео из поездки</p>
      </div>`;
    return;
  }

  grid.innerHTML = mediaList
    .map((media, idx) => {
      const videoItem = isVideo(media);
      const mediaHtml = videoItem
        ? `<div class="media-item__video-thumb">
           <video src="${api.fileUrl(media.fileUrl)}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>
           <span class="media-item__video-badge">▶ Видео</span>
         </div>`
        : `<img src="${api.fileUrl(media.thumbnailUrl || media.fileUrl)}"
             alt="${escapeHtml(media.caption || "")}"
             loading="lazy">`;
      return `
    <div class="media-item fade-in" data-index="${idx}">
      ${mediaHtml}
      ${media.exifLatitude ? `<span class="media-item__exif">📍 GPS</span>` : ""}
      <div class="media-item__overlay">
        <div class="media-item__actions">
          ${!videoItem ? `<button class="media-item__btn" onclick="openMediaEditModal(${idx})" title="Редактировать">✏️</button>` : ""}
          <button class="media-item__btn" onclick="openMediaModal(${idx})" title="Просмотр">🔍</button>
          <button class="media-item__btn" onclick="deleteMedia(${media.id})" title="Удалить">🗑️</button>
        </div>
        ${media.caption ? `<div class="media-item__caption">${escapeHtml(media.caption)}</div>` : ""}
        ${media.exifDate ? `<div class="media-item__caption" style="opacity:.7">${media.exifDate.substring(0, 10)}</div>` : ""}
      </div>
    </div>
  `;
    })
    .join("");
}

async function uploadFiles(files, endpoint, label) {
  if (!files.length) return;

  const progress = document.getElementById("uploadProgress");
  const fill = document.getElementById("uploadFill");
  const status = document.getElementById("uploadStatus");
  progress.style.display = "flex";

  let uploaded = 0;
  for (const file of files) {
    status.textContent = `Загрузка ${uploaded + 1} из ${files.length}...`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.upload(endpoint, formData);
      uploaded++;
      fill.style.width = `${(uploaded / files.length) * 100}%`;
    } catch (err) {
      showToast(`Ошибка загрузки ${file.name}: ${err.message}`, "error");
    }
  }

  progress.style.display = "none";
  fill.style.width = "0%";
  await loadMedia();
  await loadTrip(); // обновляем счётчики в шапке
  showToast(`Загружено ${uploaded} ${label}`, "success");
}

document
  .getElementById("mediaImageUpload")
  ?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    await uploadFiles(files, `/api/trips/${tripId}/media/photo`, "фото");
  });

document
  .getElementById("mediaVideoUpload")
  ?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    await uploadFiles(files, `/api/trips/${tripId}/media/video`, "видео");
  });

async function loadTripFiles() {
  try {
    const tripFiles = await api.get(`/api/trips/${tripId}/files`);
    renderTripFiles(tripFiles);
  } catch (err) {
    showToast("Ошибка загрузки файлов: " + err.message, "error");
  }
}

function renderTripFiles(tripFiles) {
  const list = document.getElementById("filesList");

  if (tripFiles.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">📄</span>
        <p class="empty-state__title">Нет загруженных файлов</p>
        <p class="empty-state__text">Загрузите билеты, брони или PDF документы</p>
      </div>`;
    return;
  }

  list.innerHTML = tripFiles
    .map((file) => {
      // Выбираем иконку по расширению
      const ext = file.originalFileName.split(".").pop().toLowerCase();
      let icon = "📄";
      if (ext === "pdf") icon = "📕";
      if (ext === "doc" || ext === "docx") icon = "📘";
      if (ext === "xls" || ext === "xlsx" || ext === "csv") icon = "📗";
      if (ext === "txt") icon = "📓";

      const sizeFormatted = (file.fileSize / 1024 / 1024).toFixed(2) + " MB";
      const dateFormatted = new Date(file.createdAt).toLocaleDateString(
        "ru-RU",
      );

      return `
      <div class="place-item fade-in" style="align-items: center">
        <div class="place-item__icon" style="background:var(--color-surface-2)">${icon}</div>
        <div class="place-item__info">
          <div class="place-item__name">${escapeHtml(file.originalFileName)}</div>
          <div class="place-item__address">${sizeFormatted} • Загружено: ${dateFormatted}</div>
        </div>
        <div class="place-item__actions">
          <a href="${api.fileUrl(file.fileUrl)}" download="${escapeHtml(file.originalFileName)}" target="_blank" class="btn-ghost btn-icon" title="Скачать">📥</a>
          <button class="btn-ghost btn-icon" onclick="deleteTripFile(${file.id})" title="Удалить">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

document.getElementById("fileUpload")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  e.target.value = "";

  const progress = document.getElementById("fileUploadProgress");
  const fill = document.getElementById("fileUploadFill");
  const status = document.getElementById("fileUploadStatus");
  progress.style.display = "flex";

  let uploaded = 0;
  for (const file of files) {
    status.textContent = `Загрузка ${uploaded + 1} из ${files.length}...`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.upload(`/api/trips/${tripId}/files`, formData);
      uploaded++;
      fill.style.width = `${(uploaded / files.length) * 100}%`;
    } catch (err) {
      showToast(`Ошибка загрузки ${file.name}: ${err.message}`, "error");
    }
  }

  progress.style.display = "none";
  fill.style.width = "0%";
  await loadTripFiles();
  await loadTrip();
  showToast(`Загружено ${uploaded} файлов`, "success");
});

async function deleteTripFile(fileId) {
  if (!confirm("Удалить файл?")) return;
  try {
    const btn = event?.currentTarget;
    if (btn) btn.disabled = true;

    await api.delete(`/api/trips/${tripId}/files/${fileId}`);
    showToast("Файл удалён", "success");
    await loadTripFiles();
    await loadTrip();
  } catch (err) {
    showToast("Ошибка удаления файла: " + err.message, "error");
  }
}

function openMediaModal(idx) {
  mediaIndex = idx;
  renderMediaViewer();
  document.getElementById("mediaModal").classList.add("open");
}

function closeMediaModal() {
  const videoEl = document.getElementById("mediaViewerVideo");
  if (videoEl) {
    videoEl.pause();
    videoEl.src = "";
  }
  document.getElementById("mediaModal").classList.remove("open");
}

function renderMediaViewer() {
  const media = mediaList[mediaIndex];
  const imgEl = document.getElementById("mediaViewerImg");
  const videoEl = document.getElementById("mediaViewerVideo");

  if (isVideo(media)) {
    imgEl.style.display = "none";
    videoEl.style.display = "block";
    videoEl.src = api.fileUrl(media.fileUrl);
    videoEl.load();
  } else {
    videoEl.style.display = "none";
    videoEl.src = "";
    imgEl.style.display = "block";
    imgEl.src = api.fileUrl(media.fileUrl);
  }

  document.getElementById("mediaViewerCaption").textContent =
    media.caption || (media.exifDate ? media.exifDate.substring(0, 10) : "");
  document.getElementById("mediaPrev").style.visibility =
    mediaIndex > 0 ? "visible" : "hidden";
  document.getElementById("mediaNext").style.visibility =
    mediaIndex < mediaList.length - 1 ? "visible" : "hidden";
}

document.getElementById("mediaPrev")?.addEventListener("click", () => {
  if (mediaIndex > 0) {
    mediaIndex--;
    renderMediaViewer();
  }
});
document.getElementById("mediaNext")?.addEventListener("click", () => {
  if (mediaIndex < mediaList.length - 1) {
    mediaIndex++;
    renderMediaViewer();
  }
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("mediaModal");
  if (!modal.classList.contains("open")) return;
  if (e.key === "ArrowLeft") {
    if (mediaIndex > 0) {
      mediaIndex--;
      renderMediaViewer();
    }
  }
  if (e.key === "ArrowRight") {
    if (mediaIndex < mediaList.length - 1) {
      mediaIndex++;
      renderMediaViewer();
    }
  }
  if (e.key === "Escape") closeMediaModal();
});

async function deleteMedia(id) {
  const media = mediaList.find((p) => p.id === id);
  if (!media) return;
  const isVid = isVideo(media);
  const promptName = isVid ? "видео" : "фотографию";
  const toastName = isVid ? "Видео удалено" : "Медиа удалено";

  if (!confirm(`Удалить ${promptName}?`)) return;
  try {
    await api.delete(`/api/trips/${tripId}/media/${id}`);
    await loadMedia();
    await loadTrip();
    showToast(toastName, "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

let editingMediaIndex = null;

function openMediaEditModal(idx) {
  editingMediaIndex = idx;
  const media = mediaList[idx];

  document.getElementById("editMediaPreview").src = api.fileUrl(
    media.thumbnailUrl || media.fileUrl,
  );
  document.getElementById("mediaCaption").value = media.caption || "";
  document.getElementById("mediaAddress").value = "";
  document.getElementById("mediaLat").value = media.exifLatitude || "";
  document.getElementById("mediaLon").value = media.exifLongitude || "";

  const badge = document.getElementById("mediaCoordsBadge");
  const text = document.getElementById("mediaCoordsText");
  if (badge && text) {
    if (media.exifLatitude && media.exifLongitude) {
      text.textContent = `${media.exifLatitude.toFixed(4)}, ${media.exifLongitude.toFixed(4)}`;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  const box = document.getElementById("mediaAddressSuggestions");
  if (box) box.style.display = "none";

  document.getElementById("mediaEditModal").classList.add("open");
}

function closeMediaEditModal() {
  document.getElementById("mediaEditModal").classList.remove("open");
  editingMediaIndex = null;
}

let mediaAddressDebounce = null;
document.getElementById("mediaAddress")?.addEventListener("input", () => {
  clearTimeout(mediaAddressDebounce);
  const q = document.getElementById("mediaAddress").value.trim();
  const box = document.getElementById("mediaAddressSuggestions");
  if (q.length < 3) {
    box.style.display = "none";
    return;
  }
  mediaAddressDebounce = setTimeout(
    () => fetchMediaAddressSuggestions(q, box),
    400,
  );
});

async function fetchMediaAddressSuggestions(query, box) {
  try {
    const results = await api.get(
      `/api/weather/geocode?q=${encodeURIComponent(query)}`,
    );
    if (!results.length) {
      box.style.display = "none";
      return;
    }
    box.innerHTML = results
      .map(
        (r) => `
      <div class="geocode-item"
           data-lat="${r.lat}" data-lon="${r.lon}"
           data-name="${escapeHtml(r.displayName)}">
        📍 ${escapeHtml(r.displayName)}
      </div>`,
      )
      .join("");
    box.style.display = "block";

    box.querySelectorAll(".geocode-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.getElementById("mediaAddress").value = item.dataset.name;
        document.getElementById("mediaLat").value = item.dataset.lat;
        document.getElementById("mediaLon").value = item.dataset.lon;

        const badge = document.getElementById("mediaCoordsBadge");
        const text = document.getElementById("mediaCoordsText");
        if (badge && text) {
          text.textContent = `${parseFloat(item.dataset.lat).toFixed(4)}, ${parseFloat(item.dataset.lon).toFixed(4)}`;
          badge.style.display = "flex";
        }
        box.style.display = "none";
      });
    });
  } catch {
    box.style.display = "none";
  }
}

document.addEventListener("click", (e) => {
  const box = document.getElementById("mediaAddressSuggestions");
  const input = document.getElementById("mediaAddress");
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = "none";
  }
});

function clearMediaCoords() {
  document.getElementById("mediaLat").value = "";
  document.getElementById("mediaLon").value = "";
  document.getElementById("mediaAddress").value = "";
  const badge = document.getElementById("mediaCoordsBadge");
  if (badge) badge.style.display = "none";
}

document
  .getElementById("saveMediaEditBtn")
  ?.addEventListener("click", async () => {
    if (editingMediaIndex === null) return;
    const media = mediaList[editingMediaIndex];

    const caption = document.getElementById("mediaCaption").value.trim();
    const latVal = document.getElementById("mediaLat").value;
    const lonVal = document.getElementById("mediaLon").value;

    const body = {
      caption: caption || null,
      latitude: latVal ? parseFloat(latVal) : null,
      longitude: lonVal ? parseFloat(lonVal) : null,
    };

    const btn = document.getElementById("saveMediaEditBtn");
    setLoading(btn, true);

    try {
      await api.put(`/api/trips/${tripId}/media/${media.id}`, body);
      closeMediaEditModal();
      await loadMedia();
      if (map) {
        map.remove();
        map = null;
        initMap();
      }
      showToast("Медиафайл обновлён", "success");
    } catch (err) {
      showToast("Ошибка: " + err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

async function loadPlaces() {
  try {
    const places = await api.get(`/api/trips/${tripId}/places`);
    renderPlaces(places);
  } catch (err) {
    showToast("Ошибка загрузки мест: " + err.message, "error");
  }
}

function renderPlaces(places) {
  const list = document.getElementById("placesList");

  if (places.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">📍</span>
        <p class="empty-state__title">Нет мест</p>
        <p class="empty-state__text">Добавьте места, которые вы посетили</p>
      </div>`;
    return;
  }

  list.innerHTML = places
    .map(
      (place) => `
    <div class="place-item fade-in">
      <div class="place-item__icon">${categoryIcon(place.category)}</div>
      <div class="place-item__info">
        <div class="place-item__name">
          ${escapeHtml(place.name)}
          ${place.rating ? `<span style="color:#f59e0b;margin-left:8px">${"★".repeat(place.rating)}</span>` : ""}
        </div>
        ${place.address ? `<div class="place-item__address">📍 ${escapeHtml(place.address)}</div>` : ""}
        ${place.note ? `<div class="place-item__note">${escapeHtml(place.note)}</div>` : ""}
      </div>
      <div class="place-item__actions">
        <button class="btn btn-ghost btn-icon" onclick="openPlaceModal(${JSON.stringify(place).replace(/"/g, "&quot;")})">✏️</button>
        <button class="btn btn-ghost btn-icon" onclick="deletePlace(${place.id})">🗑️</button>
      </div>
    </div>
  `,
    )
    .join("");
}

document
  .getElementById("addPlaceBtn")
  ?.addEventListener("click", () => openPlaceModal(null));

let addressDebounce = null;
document.getElementById("placeAddress")?.addEventListener("input", () => {
  clearTimeout(addressDebounce);
  const q = document.getElementById("placeAddress").value.trim();
  const box = document.getElementById("addressSuggestions");
  if (q.length < 3) {
    box.style.display = "none";
    return;
  }
  addressDebounce = setTimeout(() => fetchAddressSuggestions(q, box), 400);
});

document.addEventListener("click", (e) => {
  const box = document.getElementById("addressSuggestions");
  const input = document.getElementById("placeAddress");
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = "none";
  }
});

async function fetchAddressSuggestions(query, box) {
  try {
    const results = await api.get(
      `/api/weather/geocode?q=${encodeURIComponent(query)}`,
    );
    if (!results.length) {
      box.style.display = "none";
      return;
    }
    box.innerHTML = results
      .map(
        (r) => `
      <div class="geocode-item"
           data-lat="${r.lat}" data-lon="${r.lon}"
           data-name="${escapeHtml(r.displayName)}">
        📍 ${escapeHtml(r.displayName)}
      </div>`,
      )
      .join("");
    box.style.display = "block";

    box.querySelectorAll(".geocode-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.getElementById("placeAddress").value = item.dataset.name;
        document.getElementById("placeLat").value = item.dataset.lat;
        document.getElementById("placeLon").value = item.dataset.lon;
        // Показываем бейдж с координатами
        const badge = document.getElementById("placeCoordsBadge");
        const text = document.getElementById("placeCoordsText");
        if (badge && text) {
          text.textContent = `${parseFloat(item.dataset.lat).toFixed(4)}, ${parseFloat(item.dataset.lon).toFixed(4)}`;
          badge.style.display = "flex";
        }
        box.style.display = "none";
      });
    });
  } catch {
    box.style.display = "none";
  }
}

function clearPlaceCoords() {
  document.getElementById("placeLat").value = "";
  document.getElementById("placeLon").value = "";
  const badge = document.getElementById("placeCoordsBadge");
  if (badge) badge.style.display = "none";
}

function openPlaceModal(place) {
  editingPlace = place;
  placeRating = place?.rating || 0;

  document.getElementById("placeModalTitle").textContent = place
    ? "Редактировать место"
    : "Добавить место";
  document.getElementById("placeName").value = place?.name || "";
  document.getElementById("placeCategory").value =
    place?.category || "ATTRACTION";
  document.getElementById("placeAddress").value = place?.address || "";
  document.getElementById("placeLat").value = place?.latitude || "";
  document.getElementById("placeLon").value = place?.longitude || "";
  document.getElementById("placeNote").value = place?.note || "";

  const badge = document.getElementById("placeCoordsBadge");
  const text = document.getElementById("placeCoordsText");
  if (badge && text) {
    if (place?.latitude && place?.longitude) {
      text.textContent = `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  const box = document.getElementById("addressSuggestions");
  if (box) box.style.display = "none";

  renderStars(placeRating);
  document.getElementById("placeModal").classList.add("open");
}

function closePlaceModal() {
  document.getElementById("placeModal").classList.remove("open");
  editingPlace = null;
}

document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    placeRating = parseInt(star.dataset.value);
    renderStars(placeRating);
  });
  star.addEventListener("mouseover", () => {
    const val = parseInt(star.dataset.value);
    document.querySelectorAll(".star").forEach((s) => {
      s.classList.toggle("hovered", parseInt(s.dataset.value) <= val);
    });
  });
  star.addEventListener("mouseleave", () => {
    document
      .querySelectorAll(".star")
      .forEach((s) => s.classList.remove("hovered"));
  });
});

function renderStars(rating) {
  document.querySelectorAll(".star").forEach((s) => {
    s.classList.toggle("active", parseInt(s.dataset.value) <= rating);
  });
}

document.getElementById("savePlaceBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("placeName").value.trim();
  if (!name) {
    showToast("Введите название места", "error");
    return;
  }

  const body = {
    name,
    category: document.getElementById("placeCategory").value,
    address: document.getElementById("placeAddress").value.trim() || null,
    latitude: parseFloat(document.getElementById("placeLat").value) || null,
    longitude: parseFloat(document.getElementById("placeLon").value) || null,
    note: document.getElementById("placeNote").value.trim() || null,
    rating: placeRating || null,
  };

  const btn = document.getElementById("savePlaceBtn");
  setLoading(btn, true);

  try {
    if (editingPlace) {
      await api.put(`/api/trips/${tripId}/places/${editingPlace.id}`, body);
    } else {
      await api.post(`/api/trips/${tripId}/places`, body);
    }
    closePlaceModal();
    await loadPlaces();
    await loadTrip();
    if (map) {
      map.remove();
      map = null;
    }
    showToast(editingPlace ? "Место обновлено" : "Место добавлено", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

async function deletePlace(id) {
  if (!confirm("Удалить место?")) return;
  try {
    await api.delete(`/api/trips/${tripId}/places/${id}`);
    await loadPlaces();
    await loadTrip();
    showToast("Место удалено", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

async function loadJournal() {
  try {
    const entries = await api.get(`/api/trips/${tripId}/journal`);
    renderJournal(entries);
  } catch (err) {
    showToast("Ошибка загрузки дневника: " + err.message, "error");
  }
}

function renderJournal(entries) {
  const list = document.getElementById("journalList");

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">✍️</span>
        <p class="empty-state__title">Дневник пуст</p>
        <p class="empty-state__text">Запишите впечатления о сегодняшнем дне</p>
      </div>`;
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `
    <div class="journal-item fade-in">
      <div class="journal-item__header">
        <span class="journal-item__mood">${moodEmoji(entry.mood)}</span>
        <div class="journal-item__title">${escapeHtml(entry.title)}</div>
        <span class="journal-item__date">${entry.entryDate ? formatDate(entry.entryDate) : ""}</span>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-icon"
                  onclick='openJournalModal(${JSON.stringify(entry).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-ghost btn-icon" onclick="deleteEntry(${entry.id})">🗑️</button>
        </div>
      </div>
      <div class="journal-item__body" id="entry-body-${entry.id}">
        ${entry.content ? entry.content.replace(/<[^>]+>/g, "") : ""}
      </div>
      <div class="journal-item__footer">
        <span class="text-sm text-muted">${entry.content?.length > 200 ? "..." : ""}</span>
        ${
          (entry.content?.replace(/<[^>]+>/g, "").length || 0) > 200
            ? `
          <button class="btn btn-ghost btn-sm"
                  onclick="toggleEntry('${entry.id}')">Читать полностью</button>`
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");
}

function toggleEntry(id) {
  const body = document.getElementById(`entry-body-${id}`);
  body.classList.toggle("expanded");
}

document
  .getElementById("addJournalBtn")
  ?.addEventListener("click", () => openJournalModal(null));

function openJournalModal(entry) {
  editingEntry = entry;
  document.getElementById("journalModalTitle").textContent = entry
    ? "Редактировать запись"
    : "Новая запись";
  document.getElementById("journalTitle").value = entry?.title || "";
  document.getElementById("journalDate").value =
    entry?.entryDate || new Date().toISOString().slice(0, 10);
  document.getElementById("journalMood").value = entry?.mood || "";
  document.getElementById("journalContent").value =
    entry?.content?.replace(/<[^>]+>/g, "") || "";
  document.getElementById("journalModal").classList.add("open");
}

function closeJournalModal() {
  document.getElementById("journalModal").classList.remove("open");
  editingEntry = null;
}

document
  .getElementById("saveJournalBtn")
  ?.addEventListener("click", async () => {
    const title = document.getElementById("journalTitle").value.trim();
    if (!title) {
      showToast("Введите заголовок", "error");
      return;
    }

    const body = {
      title,
      entryDate: document.getElementById("journalDate").value || null,
      mood: document.getElementById("journalMood").value || null,
      content: document.getElementById("journalContent").value.trim() || null,
    };

    const btn = document.getElementById("saveJournalBtn");
    setLoading(btn, true);

    try {
      if (editingEntry) {
        await api.put(`/api/trips/${tripId}/journal/${editingEntry.id}`, body);
      } else {
        await api.post(`/api/trips/${tripId}/journal`, body);
      }
      closeJournalModal();
      await loadJournal();
      await loadTrip();
      showToast(
        editingEntry ? "Запись обновлена" : "Запись добавлена",
        "success",
      );
    } catch (err) {
      showToast("Ошибка: " + err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

async function deleteEntry(id) {
  if (!confirm("Удалить запись?")) return;
  try {
    await api.delete(`/api/trips/${tripId}/journal/${id}`);
    await loadJournal();
    await loadTrip();
    showToast("Запись удалена", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const cityInput = document.getElementById("weatherCityInput");
  const cityBtn = document.getElementById("weatherCityBtn");
  const suggestBox = document.getElementById("weatherCitySuggestions");

  if (!cityInput) return;

  let cityDebounce = null;
  cityInput.addEventListener("input", () => {
    clearTimeout(cityDebounce);
    const q = cityInput.value.trim();
    if (q.length < 2) {
      suggestBox.style.display = "none";
      return;
    }
    cityDebounce = setTimeout(
      () => fetchCitySuggestions(q, suggestBox, cityInput),
      350,
    );
  });

  document.addEventListener("click", (e) => {
    if (!cityInput.contains(e.target) && !suggestBox.contains(e.target)) {
      suggestBox.style.display = "none";
    }
  });

  cityBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) {
      showToast("Введите название города", "error");
      return;
    }
    loadWeatherByCity(city);
  });

  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const city = cityInput.value.trim();
      if (city) {
        suggestBox.style.display = "none";
        loadWeatherByCity(city);
      }
    }
  });
});

async function fetchCitySuggestions(query, box, input) {
  try {
    const results = await api.get(
      `/api/weather/geocode?q=${encodeURIComponent(query)}`,
    );
    if (!results.length) {
      box.style.display = "none";
      return;
    }
    box.innerHTML = results
      .map((r) => {

        const parts = r.displayName.split(",");
        const shortName = parts
          .slice(0, 2)
          .map((s) => s.trim())
          .join(", ");
        return `
        <div class="geocode-item" data-lat="${r.lat}" data-lon="${r.lon}"
             data-short="${escapeHtml(parts[0].trim())}"
             data-name="${escapeHtml(r.displayName)}">
          📍 ${escapeHtml(shortName)}
        </div>`;
      })
      .join("");
    box.style.display = "block";

    box.querySelectorAll(".geocode-item").forEach((item) => {
      item.addEventListener("click", () => {
        const shortName = item.dataset.short;
        input.value = shortName;
        box.style.display = "none";
        loadWeatherByCity(shortName);
      });
    });
  } catch {
    box.style.display = "none";
  }
}

async function loadWeatherByCity(city) {
  const container = document.getElementById("weatherContent");
  const btn = document.getElementById("weatherCityBtn");

  container.innerHTML =
    '<div class="skeleton skeleton-text" style="height:120px;border-radius:12px"></div>';
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Загрузка...";
  }

  try {
    const [forecast, packing] = await Promise.all([
      api.get(`/api/weather/forecast/city?city=${encodeURIComponent(city)}`),
      api.get(
        `/api/weather/packing/city?city=${encodeURIComponent(city)}&tripTitle=${encodeURIComponent(trip?.title || "")}`,
      ),
    ]);
    container.innerHTML = renderWeather(forecast, packing);
  } catch (err) {
    const msg = err.message || "Ошибка загрузки";
    container.innerHTML = `
      <div class="empty-state" style="margin-top:2rem">
        <span class="empty-state__icon">⚠️</span>
        <p class="empty-state__title">Не удалось загрузить погоду</p>
        <p class="empty-state__text">${escapeHtml(msg)}</p>
      </div>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🌤️ Показать погоду";
    }
  }
}

async function loadWeather() {
  if (trip?.city) {
    const input = document.getElementById("weatherCityInput");
    if (input && !input.value) {
      input.value = trip.city;
    }
  }
}

function renderWeather(forecast, packing) {
  const days = forecast.days?.slice(0, 7) || [];
  const cacheNote = forecast.fromCache
    ? '<span style="opacity:.6;font-size:12px"> (из кэша)</span>'
    : "";

  const daysHtml = days
    .map(
      (day) => `
    <div class="weather-day">
      <div class="weather-day__name">${shortDayName(day.date)}</div>
      <div class="weather-day__icon">${weatherIcon(day.icon)}</div>
      <div class="weather-day__temp">${Math.round(day.tempMax)}°</div>
      <div class="weather-day__min">${Math.round(day.tempMin)}°</div>
    </div>
  `,
    )
    .join("");

  const packingHtml = `
    <div class="packing-list">
      ${renderPackingSection("🎒 Необходимое", packing.essentials)}
      ${renderPackingSection("👕 Одежда", packing.clothing)}
      ${renderPackingSection("🌂 Погодное снаряжение", packing.weatherGear)}
      ${renderPackingSection("🎧 Аксессуары", packing.accessories)}
    </div>`;

  return `
    <div class="weather-widget">
      <div class="weather-widget__location">📍 ${escapeHtml(forecast.locationName)}${cacheNote}</div>
      <div class="weather-widget__summary">${escapeHtml(packing.weatherSummary || "")}</div>
      <div class="weather-days">${daysHtml}</div>
    </div>
    <h3 class="mb-4">🎒 Список вещей</h3>
    <p class="text-secondary text-sm mb-4">${escapeHtml(packing.bestTimeToVisit || "")}</p>
    ${packingHtml}
  `;
}

function renderPackingSection(title, items) {
  if (!items?.length) return "";
  return `
    <div class="packing-section card card-body">
      <div class="packing-section__title">${title}</div>
      <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`;
}

function bindHeaderActions() {
  let qrCodeInstance = null;

  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    document.getElementById("shareModal").classList.add("open");
    if (typeof switchShareTab === "function") switchShareTab("share-link-tab");

    const isPublic =
      trip.visibility === "LINK_ONLY" || trip.visibility === "PUBLIC";
    document.getElementById("shareToggle").checked = isPublic;

    if (isPublic && trip.shareToken) {
      await displayShareLink(trip.shareToken);
    } else {
      document.getElementById("shareLinkContainer").style.display = "none";
    }
  });

  async function displayShareLink(token) {
    let host = window.location.host;
    try {
      const res = await fetch("/api/system/ip");
      if (res.ok) {
        const data = await res.json();
        const port = window.location.port ? ":" + window.location.port : "";
        host = data.ip + port;
      }
    } catch (e) {}

    const shareUrl = `${window.location.protocol}//${host}/share.html?token=${token}`;
    document.getElementById("shareLink").value = shareUrl;
    document.getElementById("shareLinkContainer").style.display = "flex";

    document.getElementById("qrcode").innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(document.getElementById("qrcode"), {
        text: shareUrl,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L,
      });
    }
  }

  document
    .getElementById("shareToggle")
    ?.addEventListener("change", async (e) => {
      const isPublic = e.target.checked;
      e.target.disabled = true;

      try {
        const newVisibility = isPublic ? "LINK_ONLY" : "PRIVATE";
        const updatedTrip = await api.put(`/api/trips/${tripId}`, {
          visibility: newVisibility,
        });

        trip.visibility = updatedTrip.visibility;
        trip.shareToken = updatedTrip.shareToken;
        renderHeader();

        if (isPublic && trip.shareToken) {
          await displayShareLink(trip.shareToken);
        } else {
          document.getElementById("shareLinkContainer").style.display = "none";
        }
      } catch (err) {
        showToast("Ошибка изменения прав доступа: " + err.message, "error");
        e.target.checked = !isPublic;
      } finally {
        e.target.disabled = false;
      }
    });

  document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
    const input = document.getElementById("shareLink");
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      showToast("Ссылка скопирована!", "success");
    });
  });

  document
    .getElementById("downloadPdfBtn")
    ?.addEventListener("click", async () => {
      const sections = [];
      if (document.getElementById("pdfDescription")?.checked)
        sections.push("description");
      if (document.getElementById("pdfPlaces")?.checked)
        sections.push("places");
      if (document.getElementById("pdfJournal")?.checked)
        sections.push("journal");

      if (sections.length === 0) {
        showToast("Выберите хотя бы один раздел", "error");
        return;
      }

      const btn = document.getElementById("downloadPdfBtn");
      const originalText = btn.textContent;
      btn.textContent = "⏳ Генерация...";
      btn.disabled = true;

      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(
          `/api/trips/${tripId}/pdf?sections=${sections.join(",")}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );

        if (!response.ok) throw new Error("Ошибка генерации PDF");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trip-${tripId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        document.getElementById("shareModal").classList.remove("open");
        showToast("PDF скачан!", "success");
      } catch (err) {
        showToast("Ошибка: " + err.message, "error");
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
    }
  });
}

function setLoading(btn, loading) {
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

function statusLabel(s) {
  return (
    { PLANNED: "Запланирована", ACTIVE: "В пути", COMPLETED: "Завершена" }[s] ||
    s
  );
}
function visibilityLabel(v) {
  return (
    { PRIVATE: "Приватная", LINK_ONLY: "По ссылке", PUBLIC: "Публичная" }[v] ||
    v
  );
}
function categoryIcon(cat) {
  return (
    {
      ATTRACTION: "🏛",
      RESTAURANT: "🍽",
      HOTEL: "🏨",
      MUSEUM: "🎨",
      NATURE: "🌿",
      TRANSPORT: "🚉",
      SHOPPING: "🛍",
      ENTERTAINMENT: "🎭",
      OTHER: "📌",
    }[cat] || "📌"
  );
}
function categoryLabel(cat) {
  return (
    {
      ATTRACTION: "Достопримечательность",
      RESTAURANT: "Ресторан",
      HOTEL: "Отель",
      MUSEUM: "Музей",
      NATURE: "Природа",
      TRANSPORT: "Транспорт",
      SHOPPING: "Шоппинг",
      ENTERTAINMENT: "Развлечения",
      OTHER: "Другое",
    }[cat] || cat
  );
}
function moodEmoji(mood) {
  return (
    { AMAZING: "😍", GOOD: "😊", NEUTRAL: "😐", TIRED: "😴", BAD: "😞" }[
      mood
    ] || "😊"
  );
}
function weatherIcon(icon) {
  const map = {
    "01": "☀️",
    "02": "⛅",
    "03": "☁️",
    "04": "☁️",
    "09": "🌧",
    10: "🌦",
    11: "⛈",
    13: "❄️",
    50: "🌫",
  };
  return map[icon?.slice(0, 2)] || "🌡";
}
function shortDayName(dateStr) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { weekday: "short" });
}
function formatDateRange(start, end) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return end ? `${fmt(start)} — ${fmt(end)}` : `с ${fmt(start)}`;
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getCountryName(code) {
  if (!code) return "";
  if (code.length === 2) {
    try {
      return (
        new Intl.DisplayNames(["ru"], { type: "region" }).of(
          code.toUpperCase(),
        ) || ""
      );
    } catch (e) {
      return "";
    }
  }
  return code;
}

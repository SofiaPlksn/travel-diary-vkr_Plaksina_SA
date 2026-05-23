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

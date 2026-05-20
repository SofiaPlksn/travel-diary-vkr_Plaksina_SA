router.init("map-global.html");

let map = null;
let currentMarkers = [];
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
  await initGlobalMap();
});

async function initGlobalMap() {
  const loader = document.getElementById("mapLoader");

  try {
    const data = await api.get("/api/analytics/map");
    document.getElementById("pointsCount").textContent = data.points.length;

    map = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/streets-v2/style.json?key=BijZmsokKMHtIjwtS2cD",
      center: [30, 45],
      zoom: 3,
      attributionControl: true,
    });

    map.on("load", () => {
      setupMapData(data.points);
      setupTerminator();
      loader.classList.add("hidden");
    });
  } catch (err) {
    showToast("Ошибка загрузки карты: " + err.message, "error");
    loader.innerHTML = `<p class="text-danger">Не удалось загрузить данные</p>`;
  }
}

function setupMapData(points) {
  const geojson = {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { ...p },
    })),
  };

  map.addSource("travel-points", {
    type: "geojson",
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  map.addLayer({
    id: "travel-heat",
    type: "heatmap",
    source: "travel-points",
    maxzoom: 15,
    paint: {
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0,0,0,0)",
        0.2,
        "rgba(99, 102, 241, 0.2)",
        0.4,
        "rgba(99, 102, 241, 0.4)",
        0.6,
        "rgba(79, 70, 229, 0.6)",
        0.8,
        "rgba(67, 56, 202, 0.8)",
        1,
        "rgba(49, 46, 129, 0.9)",
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 15, 0],
    },
  });

  map.on("render", updateMarkers);
  updateMarkers();
}

function updateMarkers() {
  const newMarkers = {};
  const features = map.querySourceFeatures("travel-points");

  const uniqueFeatures = {};
  features.forEach((feature) => {
    const props = feature.properties;
    const id = props.cluster
      ? `cluster-${props.cluster_id}`
      : `point-${props.id}`;
    if (!uniqueFeatures[id]) {
      uniqueFeatures[id] = feature;
    }
  });

  Object.values(uniqueFeatures).forEach((feature) => {
    const coords = feature.geometry.coordinates;
    const props = feature.properties;
    const id = props.cluster
      ? `cluster-${props.cluster_id}`
      : `point-${props.id}`;

    if (currentMarkers[id]) {
      newMarkers[id] = currentMarkers[id];
      delete currentMarkers[id];
      return;
    }

    let el;
    if (props.cluster) {
      el = document.createElement("div");
      el.className = "cluster-media";
      el.innerHTML = `<span>${props.point_count}</span>`;
      el.onclick = () => {
        map.easeTo({ center: coords, zoom: map.getZoom() + 2 });
      };
    } else {
      el = document.createElement("div");
      if (props.type === "MEDIA") {
        el.className = "marker-media";
        el.style.backgroundImage = `url(${api.fileUrl(props.thumbnailUrl)})`;
      } else {
        el.className = "marker-place";
        el.innerHTML = "📍";
      }

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding:10px">
            <div style="font-weight:bold;margin-bottom:4px">${escapeHtml(props.title || "Без названия")}</div>
            <div style="font-size:11px;color:#64748b">Из поездки: ${escapeHtml(props.tripTitle)}</div>
          </div>
          <a href="/trip-detail.html?id=${props.tripId}" class="popup-trip-link">Перейти к поездке →</a>
        `);

      el.onclick = (e) => {
        e.stopPropagation();
        new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map)
          .togglePopup();
      };
    }
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map);

    newMarkers[id] = marker;
  });

  Object.values(currentMarkers).forEach((m) => m.remove());
  currentMarkers = newMarkers;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupTerminator() {
  map.addSource("terminator", {
    type: "geojson",
    data: getTerminatorGeoJSON(),
  });
  map.addLayer(
    {
      id: "terminator-layer",
      type: "fill",
      source: "terminator",
      paint: {
        "fill-color": "#000033",
        "fill-opacity": 0.35,
        "fill-outline-color": "rgba(0,0,0,0)",
      },
    },
    "travel-heat",
  );

  setInterval(() => {
    const source = map.getSource("terminator");
    if (source) source.setData(getTerminatorGeoJSON());
  }, 60000);
}

function getTerminatorGeoJSON() {
  const date = new Date();

  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const d = julianDay - 2451545.0;

  const norm = (a) => ((a % 360) + 360) % 360;

  const L = norm(280.46 + 0.9856474 * d);
  const g = norm(357.528 + 0.9856003 * d);
  const gRad = (g * Math.PI) / 180;

  const lambdaDeg = L + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad);
  const lambda = (lambdaDeg * Math.PI) / 180;

  const epsilon = ((23.439 - 0.0000004 * d) * Math.PI) / 180;

  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));

  const gmst = norm(280.46061837 + 360.98564736629 * d);

  const subsolarLon = norm((ra * 180) / Math.PI - gmst + 540) - 180;
  const subsolarLat = (dec * 180) / Math.PI;

  const terminatorLine = [];
  const resolution = 2;

  for (let lon = -180; lon <= 180; lon += resolution) {
    const hourAngle = ((lon - subsolarLon) * Math.PI) / 180;

    const lat = Math.atan(-Math.cos(hourAngle) / Math.tan(dec));
    terminatorLine.push([lon, (lat * 180) / Math.PI]);
  }

  const nightPole = subsolarLat > 0 ? -90 : 90;

  const polygon = [
    ...terminatorLine,
    [180, nightPole],
    [-180, nightPole],
    terminatorLine[0], // замыкаем
  ];

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [polygon],
    },
  };
}

let radarLayerId = "rainviewer-radar";
let radarActive = false;

document
  .getElementById("toggleRadarBtn")
  ?.addEventListener("click", async (e) => {
    if (!map) return;
    const btn = e.target;

    if (radarActive) {
      if (map.getLayer(radarLayerId)) map.removeLayer(radarLayerId);
      if (map.getSource(radarLayerId)) map.removeSource(radarLayerId);
      radarActive = false;
      btn.innerHTML = "🌧 Показать радар осадков";
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

      map.addSource(radarLayerId, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: RAINVIEWER_TILE_SIZE,
        maxzoom: RAINVIEWER_MAX_ZOOM,
        attribution:
          '<a href="https://rainviewer.com" target="_blank">© RainViewer</a>',
      });
      map.addLayer({
        id: radarLayerId,
        type: "raster",
        source: radarLayerId,
        paint: {
          "raster-opacity": 0.7,
          "raster-resampling": "linear",
        },
      });

      radarActive = true;
      btn.innerHTML = "☀️ Скрыть радар";
      btn.classList.remove("btn-secondary");
      btn.classList.add("btn-primary");
    } catch (err) {
      if (map.getLayer(radarLayerId)) map.removeLayer(radarLayerId);
      if (map.getSource(radarLayerId)) map.removeSource(radarLayerId);
      radarActive = false;
      console.error("Radar load error:", err);
      showToast("Не удалось загрузить данные радара", "error");
      btn.innerHTML = "🌧 Показать радар осадков";
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });

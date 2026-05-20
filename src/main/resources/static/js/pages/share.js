const token = new URLSearchParams(window.location.search).get("token");
let mediaList = [];
let mediaIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
  if (!token) {
    showError();
    return;
  }

  try {
    const trip = await loadPublicTrip(token);
    renderPage(trip);
    await loadExtras(token);
  } catch {
    showError();
  }
});

async function loadPublicTrip(token) {
  const response = await fetch(`/api/trips/public/${token}`);
  if (!response.ok) throw new Error("Not found");
  return response.json();
}

function renderPage(trip) {
  document.getElementById("pageLoader").style.display = "none";
  document.getElementById("shareContent").style.display = "block";

  document.title = `${trip.title} — TravelDiary`;

  if (trip.coverImageUrl) {
    const hero = document.getElementById("shareHero");
    hero.style.backgroundImage = `url(${api.fileUrl(trip.coverImageUrl)})`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  }

  document.getElementById("heroBadges").innerHTML = `
    <span class="badge badge-${trip.status.toLowerCase()}">${statusLabel(trip.status)}</span>
    <span class="badge badge-public">🌍 Публичная поездка</span>
  `;

  document.getElementById("shareTitle").textContent = trip.title;
  const metaParts = [];
  if (trip.city || trip.country)
    metaParts.push(
      `<span>📍 ${escapeHtml([trip.city, getCountryName(trip.country)].filter(Boolean).join(", "))}</span>`,
    );
  if (trip.startDate)
    metaParts.push(
      `<span>📅 ${formatDateRange(trip.startDate, trip.endDate)}</span>`,
    );
  if (trip.budget)
    metaParts.push(`<span>💰 ${trip.budget.toLocaleString("ru-RU")} ₽</span>`);

  document.getElementById("shareMeta").innerHTML = metaParts.join("");

  document.getElementById("shareStats").innerHTML = `
    <div class="share-stat">
      <div class="share-stat__value">${trip.mediaCount || 0}</div>
      <div class="share-stat__label">Медиа</div>
    </div>
    <div class="share-stat">
      <div class="share-stat__value">${trip.placesCount || 0}</div>
      <div class="share-stat__label">Мест</div>
    </div>
    <div class="share-stat">
      <div class="share-stat__value">${trip.journalEntriesCount || 0}</div>
      <div class="share-stat__label">Записей</div>
    </div>
  `;

  if (trip.description) {
    const el = document.getElementById("shareDescription");
    el.textContent = trip.description;
    el.style.display = "block";
  }

  if (trip.tags?.length) {
    document.getElementById("shareTags").innerHTML = trip.tags
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
  }
}

async function loadExtras(token) {
  await Promise.allSettled([
    loadPublicPlaces(token),
    loadPublicMedia(token),
    loadPublicJournal(token),
  ]);
}

async function loadPublicPlaces(token) {
  try {
    const places = await fetchPublic(`/api/trips/public/${token}/places`);
    if (!places.length) return;

    document.getElementById("placesSection").style.display = "block";

    document.getElementById("sharePlaces").innerHTML = places
      .map(
        (p) => `
      <div class="share-place">
        <div class="share-place__icon">${categoryIcon(p.category)}</div>
        <div>
          <div class="share-place__name">${escapeHtml(p.name)}</div>
          ${p.address ? `<div class="share-place__address">📍 ${escapeHtml(p.address)}</div>` : ""}
          ${p.rating ? `<div class="share-place__rating">${"★".repeat(p.rating)}${"☆".repeat(5 - p.rating)}</div>` : ""}
          ${p.note ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:4px;font-style:italic">${escapeHtml(p.note)}</div>` : ""}
        </div>
      </div>
    `,
      )
      .join("");

    const withCoords = places.filter((p) => p.latitude && p.longitude);
    if (withCoords.length) {
      document.getElementById("mapSection").style.display = "block";
      initShareMap(withCoords);
    }
  } catch {
  }
}

function initShareMap(places) {
  const center = [places[0].longitude, places[0].latitude];

  const map = new maplibregl.Map({
    container: "shareMap",
    style:
      "https://api.maptiler.com/maps/streets-v2/style.json?key=BijZmsokKMHtIjwtS2cD",
    center: center,
    zoom: 10,
    attributionControl: true,
  });

  map.on("load", () => {
    const allCoords = [];

    places.forEach((place) => {
      const popupHtml = `
        <div style="padding:8px;min-width:140px">
          <div style="font-weight:600">${escapeHtml(place.name)}</div>
          ${place.address ? `<div style="font-size:12px;color:#64748b">${escapeHtml(place.address)}</div>` : ""}
          ${place.rating ? `<div style="color:#f59e0b;margin-top:4px">${"★".repeat(place.rating)}${"☆".repeat(5 - place.rating)}</div>` : ""}
        </div>`;

      new maplibregl.Marker({ color: "#6366f1" })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML(popupHtml))
        .addTo(map);

      allCoords.push([place.longitude, place.latitude]);
    });

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
    }
  });
}

function isVideo(media) {
  return media.contentType && media.contentType.startsWith("video/");
}

async function loadPublicMedia(token) {
  try {
    mediaList = await fetchPublic(`/api/trips/public/${token}/media`);
    if (!mediaList.length) return;

    document.getElementById("mediaSection").style.display = "block";

    document.getElementById("shareMedia").innerHTML = mediaList
      .map((media, idx) => {
        const mediaHtml = isVideo(media)
          ? `<div class="media-item__video-thumb">
             <video src="${api.fileUrl(media.fileUrl)}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>
             <span class="media-item__video-badge">▶ Видео</span>
           </div>`
          : `<img src="${api.fileUrl(media.thumbnailUrl || media.fileUrl)}"
                alt="${escapeHtml(media.caption || "")}"
                loading="lazy">`;

        return `
        <div class="share-media" onclick="openMediaModal(${idx})">
          ${mediaHtml}
        </div>
      `;
      })
      .join("");
  } catch {
  }
}

function openMediaModal(idx) {
  mediaIndex = idx;
  updateMediaViewer();
  document.getElementById("mediaModal").classList.add("open");
}

function updateMediaViewer() {
  const media = mediaList[mediaIndex];
  const imgEl = document.getElementById("mediaViewerImg");
  const videoEl = document.getElementById("mediaViewerVideo");

  if (isVideo(media)) {
    imgEl.style.display = "none";
    if (videoEl) {
      videoEl.style.display = "block";
      videoEl.src = api.fileUrl(media.fileUrl);
      videoEl.load();
    }
  } else {
    if (videoEl) {
      videoEl.style.display = "none";
      videoEl.src = "";
    }
    imgEl.style.display = "block";
    imgEl.src = api.fileUrl(media.fileUrl);
  }

  document.getElementById("mediaPrev").style.visibility =
    mediaIndex > 0 ? "visible" : "hidden";
  document.getElementById("mediaNext").style.visibility =
    mediaIndex < mediaList.length - 1 ? "visible" : "hidden";
}

document.getElementById("mediaPrev")?.addEventListener("click", () => {
  if (mediaIndex > 0) {
    mediaIndex--;
    updateMediaViewer();
  }
});
document.getElementById("mediaNext")?.addEventListener("click", () => {
  if (mediaIndex < mediaList.length - 1) {
    mediaIndex++;
    updateMediaViewer();
  }
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("mediaModal");
  if (!modal?.classList.contains("open")) return;
  if (e.key === "ArrowLeft") {
    if (mediaIndex > 0) {
      mediaIndex--;
      updateMediaViewer();
    }
  }
  if (e.key === "ArrowRight") {
    if (mediaIndex < mediaList.length - 1) {
      mediaIndex++;
      updateMediaViewer();
    }
  }
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("mediaModal");
  if (e.key === "Escape") {
    if (modal?.classList.contains("open")) closeMediaModal();
    document
      .querySelectorAll(".modal-overlay.open")
      .forEach((m) => m.classList.remove("open"));
  }
});

function closeMediaModal() {
  const videoEl = document.getElementById("mediaViewerVideo");
  if (videoEl) {
    videoEl.pause();
    videoEl.src = "";
  }
  document.getElementById("mediaModal").classList.remove("open");
}

document.getElementById("mediaModal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("mediaModal")) {
    closeMediaModal();
  }
});

async function loadPublicJournal(token) {
  try {
    const entries = await fetchPublic(`/api/trips/public/${token}/journal`);
    if (!entries.length) return;

    document.getElementById("journalSection").style.display = "block";

    document.getElementById("shareJournal").innerHTML = entries
      .map(
        (entry) => `
      <div class="share-journal-entry">
        <div class="share-journal-entry__header">
          <span class="share-journal-entry__mood">${moodEmoji(entry.mood)}</span>
          <span class="share-journal-entry__title">${escapeHtml(entry.title)}</span>
          <span class="share-journal-entry__date">
            ${entry.entryDate ? formatDate(entry.entryDate) : ""}
          </span>
        </div>
        ${
          entry.content
            ? `
          <div class="share-journal-entry__body">
            ${entry.content}
          </div>`
            : ""
        }
      </div>
    `,
      )
      .join("");
  } catch {
  }
}

async function fetchPublic(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function showError() {
  document.getElementById("pageLoader").style.display = "none";
  document.getElementById("errorState").style.display = "flex";
}

function statusLabel(s) {
  return (
    { PLANNED: "Запланирована", ACTIVE: "В пути", COMPLETED: "Завершена" }[s] ||
    s
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
function moodEmoji(mood) {
  return (
    { AMAZING: "😍", GOOD: "😊", NEUTRAL: "😐", TIRED: "😴", BAD: "😞" }[
      mood
    ] || "😊"
  );
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

document.getElementById("sharePdfBtn")?.addEventListener("click", () => {
  document.getElementById("pdfModal").classList.add("open");
});

document
  .getElementById("downloadPdfBtn")
  ?.addEventListener("click", async () => {
    const sections = [];
    if (document.getElementById("pdfDescription")?.checked)
      sections.push("description");
    if (document.getElementById("pdfPlaces")?.checked) sections.push("places");
    if (document.getElementById("pdfJournal")?.checked)
      sections.push("journal");

    if (sections.length === 0) {
      alert("Выберите хотя бы один раздел");
      return;
    }

    const btn = document.getElementById("downloadPdfBtn");
    const originalText = btn.textContent;
    btn.textContent = "⏳ Генерация...";
    btn.disabled = true;

    try {
      const response = await fetch(
        `/api/trips/public/${token}/pdf?sections=${sections.join(",")}`,
      );

      if (!response.ok) throw new Error("Ошибка генерации PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trip-${token.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      document.getElementById("pdfModal").classList.remove("open");
    } catch (err) {
      alert("Ошибка: " + err.message);
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

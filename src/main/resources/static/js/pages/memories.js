router.init("memories.html");

document.addEventListener("DOMContentLoaded", async () => {
  renderTodayLabel();

  await Promise.allSettled([
    loadTodayMemories(),
    loadRecentTrips(),
    loadRandomMedia(),
    loadMemoriesNumbers(),
  ]);
});

function renderTodayLabel() {
  const today = new Date();
  const label = today.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  document.getElementById("todayLabel").textContent =
    label.charAt(0).toUpperCase() + label.slice(1);
}

async function loadTodayMemories() {
  const container = document.getElementById("todayContent");
  const countEl = document.getElementById("todayCount");

  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const memories = await api.get(
      `/api/trips/memories?month=${month}&day=${day}`,
    );

    if (!memories.length) {
      countEl.textContent = "";
      container.innerHTML = `
        <div class="today-empty">
          <span class="today-empty__icon">🌅</span>
          <p class="today-empty__title">В этот день поездок не было</p>
          <p class="today-empty__text">
            Путешествуйте больше — и здесь появятся воспоминания!
          </p>
          <a href="/trip-create.html" class="btn btn-primary mt-4">
            Запланировать поездку
          </a>
        </div>`;
      return;
    }

    countEl.textContent = pluralize(
      memories.length,
      "поездка",
      "поездки",
      "поездок",
    );
    container.innerHTML = `<div class="memories-grid">${memories.map(renderMemoryCard).join("")}</div>`;

    memories.forEach((trip) => {
      if (trip.city) {
        fetchHistoricalWeather(trip.id, trip.city, trip.startDate);
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Не удалось загрузить воспоминания</p>`;
    console.error(err);
  }
}

async function fetchHistoricalWeather(tripId, city, date) {
  const badgeEl = document.getElementById(`memory-weather-${tripId}`);
  if (!badgeEl) return;
  try {
    const data = await api.get(
      `/api/weather/historical/city?city=${encodeURIComponent(city)}&date=${date}`,
    );
    if (data && data.icon) {
      badgeEl.innerHTML = `<span style="font-size: 1.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2))">${getWeatherEmoji(data.icon)}</span> <span style="font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.5)">${data.tempCurrent > 0 ? "+" : ""}${data.tempCurrent}°C</span>`;
      badgeEl.style.opacity = 1;
    }
  } catch (e) {
    console.warn("Could not fetch historical weather for trip " + tripId, e);
  }
}

function getWeatherEmoji(icon) {
  if (!icon) return "☁️";
  if (icon.includes("01")) return "☀️";
  if (icon.includes("02") || icon.includes("03") || icon.includes("04"))
    return "☁️";
  if (icon.includes("09") || icon.includes("10")) return "🌧️";
  if (icon.includes("11")) return "⛈️";
  if (icon.includes("13")) return "❄️";
  if (icon.includes("50")) return "🌫️";
  return "☁️";
}

function renderMemoryCard(trip) {
  const gradientIndex = trip.id % 8;
  const emoji = getCountryEmoji(trip.country);
  const yearsAgo =
    new Date().getFullYear() - new Date(trip.startDate).getFullYear();
  const yearsLabel =
    yearsAgo === 0
      ? "В этом году"
      : `${pluralize(yearsAgo, "год", "года", "лет")} назад`;

  const coverHtml = trip.coverImageUrl
    ? `<img src="${api.fileUrl(trip.coverImageUrl)}" class="memory-card__cover" alt="" style="object-fit:cover">`
    : `<div class="memory-card__cover cover-gradient-${gradientIndex}">
         <span>${emoji}</span>
       </div>`;

  return `
    <a href="/trip-detail.html?id=${trip.id}" class="memory-card fade-in">
      <div style="position:relative">
        ${coverHtml}
        <span class="memory-card__years-ago">${yearsLabel}</span>
        <div id="memory-weather-${trip.id}" class="memory-card__weather" style="position:absolute; bottom:12px; right:12px; color:white; display:flex; align-items:center; gap:6px; opacity:0; transition:opacity 0.3s; z-index:10;">
        </div>
      </div>
      <div class="memory-card__body">
        <div class="memory-card__title">${escapeHtml(trip.title)}</div>
        <div class="memory-card__location">
          📍 ${escapeHtml([trip.city, getCountryName(trip.country)].filter(Boolean).join(", "))}
        </div>
        <div class="text-xs text-muted">
          📅 ${formatDate(trip.startDate)}
          ${trip.endDate ? ` — ${formatDate(trip.endDate)}` : ""}
        </div>
      </div>
      <div class="memory-card__footer">
        <span class="memory-card__stat">🖼️ ${trip.mediaCount || 0}</span>
        <span class="memory-card__stat">📍 ${trip.placesCount || 0} мест</span>
        <span class="memory-card__stat">✍️ ${trip.journalEntriesCount || 0}</span>
        <span class="badge badge-${trip.status.toLowerCase()}" style="margin-left:auto">
          ${statusLabel(trip.status)}
        </span>
      </div>
    </a>
  `;
}
async function loadRecentTrips() {
  const container = document.getElementById("recentContent");

  try {
    const data = await api.get("/api/trips?page=0&size=4&sort=startDate,desc");
    const trips = data.content || [];

    if (!trips.length) {
      container.innerHTML = `
        <div class="today-empty">
          <span class="today-empty__icon">✈️</span>
          <p class="today-empty__title">Нет поездок</p>
          <a href="/trip-create.html" class="btn btn-primary mt-4">Создать первую</a>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="recent-grid">
        ${trips
          .map(
            (t) => `
          <a href="/trip-detail.html?id=${t.id}" class="recent-card fade-in">
            <div class="recent-card__cover cover-gradient-${t.id % 8}">
              ${
                t.coverImageUrl
                  ? `<img src="${api.fileUrl(t.coverImageUrl)}" alt="">`
                  : getCountryEmoji(t.country)
              }
            </div>
            <div class="recent-card__body">
              <div class="recent-card__title">${escapeHtml(t.title)}</div>
              <div class="recent-card__meta">
                📍 ${escapeHtml(getCountryName(t.country))}
                ${t.startDate ? ` · ${formatDate(t.startDate)}` : ""}
              </div>
            </div>
          </a>
        `,
          )
          .join("")}
      </div>`;
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Не удалось загрузить поездки</p>`;
  }
}

async function loadRandomMedia() {
  const container = document.getElementById("randomMediaContent");

  try {
    const data = await api.get("/api/trips?page=0&size=50&sort=startDate,desc");
    const trips = (data.content || []).filter((t) => t.mediaCount > 0);

    if (!trips.length) {
      container.innerHTML = `
        <div class="today-empty">
          <span class="today-empty__icon">🖼️</span>
          <p class="today-empty__title">Нет медиафайлов</p>
          <p class="today-empty__text">Загрузите фото или видео в поездку, чтобы они появились здесь</p>
        </div>`;
      return;
    }

    const randomTrip = trips[Math.floor(Math.random() * trips.length)];
    const mediaList = await api.get(`/api/trips/${randomTrip.id}/media`);

    if (!mediaList.length) {
      container.innerHTML = `<div class="today-empty"><span class="today-empty__icon">🖼️</span></div>`;
      return;
    }

    const media = mediaList[Math.floor(Math.random() * mediaList.length)];
    renderRandomMedia(media, randomTrip);
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Не удалось загрузить медиа</p>`;
  }
}

function renderRandomMedia(media, trip) {
  const container = document.getElementById("randomMediaContent");

  let imgHtml;
  if (!media.fileUrl) {
    imgHtml = `<div class="random-media-card__placeholder">📷</div>`;
  } else if (media.contentType && media.contentType.startsWith("video/")) {
    imgHtml = `<video class="random-media-card__img"
                      src="${api.fileUrl(media.fileUrl)}"
                      muted preload="metadata" style="object-fit:cover"></video>`;
  } else {
    imgHtml = `<img class="random-media-card__img"
                    src="${api.fileUrl(media.fileUrl)}"
                    alt="${escapeHtml(media.caption || "")}">`;
  }

  const exifParts = [];
  if (media.exifDate) exifParts.push(`📅 ${media.exifDate.substring(0, 10)}`);
  if (media.exifCamera) exifParts.push(`📷 ${escapeHtml(media.exifCamera)}`);
  if (media.exifLatitude)
    exifParts.push(
      `📍 ${media.exifLatitude.toFixed(4)}, ${media.exifLongitude.toFixed(4)}`,
    );

  container.innerHTML = `
    <div class="random-media-card fade-in">
      ${imgHtml}
      <div class="random-media-card__info">
        <a href="/trip-detail.html?id=${trip.id}"
           class="random-media-card__trip">✈️ ${escapeHtml(trip.title)}</a>
        <div class="random-media-card__caption">
          ${escapeHtml(media.caption || "Медиа из поездки")}
        </div>
        ${
          exifParts.length
            ? `
          <div class="random-media-card__exif">
            ${exifParts.map((p) => `<span>${p}</span>`).join("")}
          </div>`
            : ""
        }
        <a href="/trip-detail.html?id=${trip.id}"
           class="btn btn-secondary btn-sm" style="align-self:flex-start">
          Открыть поездку →
        </a>
      </div>
    </div>`;
}

document
  .getElementById("refreshRandomBtn")
  ?.addEventListener("click", async () => {
    document.getElementById("randomMediaContent").innerHTML =
      `<div class="skeleton" style="height:320px; border-radius:16px"></div>`;
    await loadRandomMedia();
  });

async function loadMemoriesNumbers() {
  const container = document.getElementById("memoriesNumbers");

  try {
    const data = await api.get("/api/analytics");

    const totalDays = data.totalTripDays || 0;

    const numbers = [
      { value: data.totalTrips || 0, label: "Всего поездок", icon: "✈️" },
      {
        value: data.countriesVisited || 0,
        label: "Стран посещено",
        icon: "🌍",
      },
      { value: data.totalMedia || 0, label: "Медиафайлов", icon: "🖼️" },
      { value: totalDays, label: "Дней в дороге", icon: "🗓" },
    ];

    container.innerHTML = numbers
      .map(
        (n) => `
      <div class="memory-number fade-in">
        <div style="font-size:1.8rem; margin-bottom:var(--space-2)">${n.icon}</div>
        <div class="memory-number__value">${n.value}</div>
        <div class="memory-number__label">${n.label}</div>
      </div>
    `,
      )
      .join("");
  } catch {
    container.innerHTML = "";
  }
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function statusLabel(s) {
  return (
    { PLANNED: "Запланирована", ACTIVE: "В пути", COMPLETED: "Завершена" }[s] ||
    s
  );
}
function getCountryEmoji(country) {
  const code = country?.toUpperCase();
  const emojis = {
    IT: "🍕🏛️",
    FR: "🥐🗼",
    JP: "🍣🗻",
    ES: "🥘💃",
    DE: "🥨🍺",
    US: "🍔🗽",
    TH: "🍜🐘",
    TR: "☕🕌",
    GR: "🏺🥙",
    RU: "🪆🐻",
    CN: "🐉🏯",
    BR: "☕🦜",
    IN: "🍛🛕",
    GB: "☕💂",
    AU: "🦘🏄",
    AE: "🐪🏙️",
    EG: "🏜️🐪",
    GE: "🍷⛰️",
    KZ: "🐎⛰️",
    BY: "🥔🚜",
    Italy: "🍕🏛️",
    France: "🥐🗼",
    Japan: "🍣🗻",
    Spain: "🥘💃",
    Germany: "🥨🍺",
    USA: "🍔🗽",
    Thailand: "🍜🐘",
    Turkey: "☕🕌",
    Greece: "🏺🥙",
    Russia: "🪆🐻",
    Италия: "🍕🏛️",
    Франция: "🥐🗼",
    Япония: "🍣🗻",
    Испания: "🥘💃",
    Германия: "🥨🍺",
    США: "🍔🗽",
    Таиланд: "🍜🐘",
    Турция: "☕🕌",
    Греция: "🏺🥙",
    Россия: "🪆🐻",
  };
  return emojis[code] || emojis[country] || "✈️🌍";
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
function pluralize(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} ${one}`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return `${n} ${few}`;
  return `${n} ${many}`;
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

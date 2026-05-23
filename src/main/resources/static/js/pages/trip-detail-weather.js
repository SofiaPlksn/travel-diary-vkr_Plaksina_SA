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
  const sourceNote = packing.recommendationSource
    ? `<span style="display:inline-block;margin-left:.5rem;opacity:.65;font-size:12px">${escapeHtml(packing.recommendationSource)}</span>`
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
      <div class="weather-widget__summary">${escapeHtml(packing.weatherSummary || "")}${sourceNote}</div>
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

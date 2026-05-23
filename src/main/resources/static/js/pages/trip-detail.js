router.init("trip-detail.html");

const tripId = new URLSearchParams(window.location.search).get("id");
let trip = null;
let map = null;
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

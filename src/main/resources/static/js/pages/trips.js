router.init("trips.html");

const state = {
  trips: [],
  page: 0,
  size: 9,
  total: 0,
  totalPages: 0,
  view: "grid",
  search: "",
  status: "",
  year: "",
  sort: "startDate,desc",
  deletingId: null,
};

const els = {
  skeletonGrid: document.getElementById("skeletonGrid"),
  tripsGrid: document.getElementById("tripsGrid"),
  tripsList: document.getElementById("tripsList"),
  emptyState: document.getElementById("emptyState"),
  tripsCount: document.getElementById("tripsCount"),
  pagination: document.getElementById("pagination"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  yearFilter: document.getElementById("yearFilter"),
  sortSelect: document.getElementById("sortSelect"),
  viewGrid: document.getElementById("viewGrid"),
  viewList: document.getElementById("viewList"),
  deleteModal: document.getElementById("deleteModal"),
  deleteTripName: document.getElementById("deleteTripName"),
  confirmDelete: document.getElementById("confirmDelete"),
};

document.addEventListener("DOMContentLoaded", () => {
  loadTrips();
  loadYears();
  bindEvents();
});

async function loadTrips() {
  showSkeleton(true);

  try {
    const params = new URLSearchParams({
      page: state.page,
      size: state.size,
      sort: state.sort,
    });
    if (state.search) params.set("search", state.search);
    if (state.status) params.set("status", state.status);
    if (state.year) params.set("year", state.year);

    const data = await api.get(`/api/trips?${params}`);

    state.trips = data.content;
    state.total = data.totalElements;
    state.totalPages = data.totalPages;

    renderTrips();
    renderPagination();
    updateCount();
  } catch (err) {
    showToast("Ошибка загрузки поездок: " + err.message, "error");
  } finally {
    showSkeleton(false);
  }
}

async function loadYears() {
  try {
    const years = await api.get("/api/trips/years");
    if (els.yearFilter && years.length > 0) {
      els.yearFilter.innerHTML = '<option value="">Все года</option>';
      years.forEach((year) => {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = `${year}`;
        els.yearFilter.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Не удалось загрузить года:", err);
  }
}

function renderTrips() {
  if (state.trips.length === 0) {
    els.tripsGrid.style.display = "none";
    els.tripsList.style.display = "none";
    els.emptyState.style.display = "block";
    return;
  }

  els.emptyState.style.display = "none";

  if (state.view === "grid") {
    els.tripsList.style.display = "none";
    els.tripsGrid.style.display = "grid";
    els.tripsGrid.innerHTML = state.trips.map(renderTripCard).join("");
  } else {
    els.tripsGrid.style.display = "none";
    els.tripsList.style.display = "block";
    els.tripsList.innerHTML = state.trips.map(renderTripListItem).join("");
  }

  bindCardActions();
}

function renderTripCard(trip) {
  const gradientIndex = trip.id % 8;
  const emoji = getCountryEmoji(trip.country);
  const safeTitle = escapeHtml(trip.title);
  const coverHtml = trip.coverImageUrl
    ? `<img src="${api.fileUrl(trip.coverImageUrl)}" class="trip-card__cover" alt="${safeTitle}">`
    : `<div class="trip-card__cover cover-gradient-${gradientIndex}">
         <span class="trip-card__cover-emoji">${emoji}</span>
       </div>`;

  return `
    <div class="trip-card fade-in" data-id="${trip.id}">
      <div class="trip-card__actions">
        <a href="/trip-create.html?id=${trip.id}"
           class="trip-card__action-btn" title="Редактировать">✏️</a>
        <button class="trip-card__action-btn delete-btn"
                data-id="${trip.id}" data-name="${safeTitle}" title="Удалить">🗑️</button>
      </div>

      <a href="/trip-detail.html?id=${trip.id}">
        ${coverHtml}
      </a>

      <a href="/trip-detail.html?id=${trip.id}" class="trip-card__body" style="display:block; text-decoration:none; color:inherit">
        <div class="flex justify-between items-start mb-2">
          <h3 class="trip-card__title">${safeTitle}</h3>
          <span class="badge badge-${trip.status.toLowerCase()}">${statusLabel(trip.status)}</span>
        </div>

        <div class="trip-card__location">
          📍 ${escapeHtml(trip.city || "")}${trip.city && trip.country ? ", " : ""}${escapeHtml(getCountryName(trip.country))}
        </div>

        ${
          trip.startDate
            ? `
          <div class="text-sm text-muted mt-2">
            📅 ${formatDateRange(trip.startDate, trip.endDate)}
          </div>`
            : ""
        }
      </a>

      <div class="trip-card__footer">
        <div class="trip-card__stats">
          <span class="trip-card__stat">📸 ${trip.mediaCount || 0}</span>
          <span class="trip-card__stat">📍 ${trip.placesCount || 0}</span>
          <span class="trip-card__stat">✍️ ${trip.journalEntriesCount || 0}</span>
        </div>

        ${
          trip.tags?.length
            ? `
          <div class="flex gap-1">
            ${trip.tags
              .slice(0, 2)
              .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
              .join("")}
          </div>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderTripListItem(trip) {
  const gradientIndex = trip.id % 8;
  const emoji = getCountryEmoji(trip.country);
  const safeTitle = escapeHtml(trip.title);
  const location = [trip.city, getCountryName(trip.country)]
    .filter(Boolean)
    .join(", ");
  const coverHtml = trip.coverImageUrl
    ? `<img src="${api.fileUrl(trip.coverImageUrl)}" class="trip-list-item__cover" alt="${safeTitle}">`
    : `<div class="trip-list-item__cover cover-gradient-${gradientIndex}">${emoji}</div>`;

  return `
    <div class="trip-list-item fade-in" data-id="${trip.id}">
      <a href="/trip-detail.html?id=${trip.id}" class="trip-list-item__link">
        ${coverHtml}
        <div class="trip-list-item__info">
          <div class="trip-list-item__title">${safeTitle}</div>
          <div class="trip-list-item__meta">
            ${location ? `<span>📍 ${escapeHtml(location)}</span>` : ""}
            ${trip.startDate ? `<span>📅 ${formatDateRange(trip.startDate, trip.endDate)}</span>` : ""}
            <span>📸 ${trip.mediaCount || 0} медиа</span>
            <span>📍 ${trip.placesCount || 0} мест</span>
          </div>
        </div>
      </a>
      <div class="trip-list-item__actions">
        <span class="badge badge-${trip.status.toLowerCase()}">${statusLabel(trip.status)}</span>
        <a href="/trip-create.html?id=${trip.id}" class="btn btn-ghost btn-icon">✏️</a>
        <button class="btn btn-ghost btn-icon delete-btn" data-id="${trip.id}" data-name="${safeTitle}">🗑️</button>
      </div>
    </div>
  `;
}

function bindCardActions() {
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDeleteModal(btn.dataset.id, btn.dataset.name);
    });
  });
}

function renderPagination() {
  if (state.totalPages <= 1) {
    els.pagination.style.display = "none";
    return;
  }

  els.pagination.style.display = "flex";

  let html = "";

  html += `<button class="btn btn-secondary btn-sm" ${state.page === 0 ? "disabled" : ""}
             onclick="goToPage(${state.page - 1})">←</button>`;

  for (let i = 0; i < state.totalPages; i++) {
    if (
      i === 0 ||
      i === state.totalPages - 1 ||
      Math.abs(i - state.page) <= 2
    ) {
      html += `<button class="btn btn-secondary btn-sm ${i === state.page ? "active" : ""}"
                 onclick="goToPage(${i})">${i + 1}</button>`;
    } else if (Math.abs(i - state.page) === 3) {
      html += `<span class="text-muted" style="padding: 0 4px;">…</span>`;
    }
  }

  html += `<button class="btn btn-secondary btn-sm"
             ${state.page >= state.totalPages - 1 ? "disabled" : ""}
             onclick="goToPage(${state.page + 1})">→</button>`;

  els.pagination.innerHTML = html;
}

function goToPage(page) {
  state.page = page;
  loadTrips();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDeleteModal(id, name) {
  state.deletingId = id;
  els.deleteTripName.textContent = `"${name}"`;
  els.deleteModal.classList.add("open");
}

document
  .getElementById("closeDeleteModal")
  ?.addEventListener("click", closeDeleteModal);
document
  .getElementById("cancelDelete")
  ?.addEventListener("click", closeDeleteModal);
els.deleteModal?.addEventListener("click", (e) => {
  if (e.target === els.deleteModal) closeDeleteModal();
});

function closeDeleteModal() {
  els.deleteModal.classList.remove("open");
  state.deletingId = null;
}

els.confirmDelete?.addEventListener("click", async () => {
  if (!state.deletingId) return;

  setLoading(els.confirmDelete, true);
  try {
    await api.delete(`/api/trips/${state.deletingId}`);
    closeDeleteModal();
    showToast("Поездка удалена", "success");
    loadTrips();
  } catch (err) {
    showToast("Ошибка удаления: " + err.message, "error");
  } finally {
    setLoading(els.confirmDelete, false);
  }
});

function bindEvents() {

  let searchTimer;
  els.searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 0;
      loadTrips();
    }, 400);
  });

  els.statusFilter?.addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 0;
    loadTrips();
  });

  els.yearFilter?.addEventListener("change", (e) => {
    state.year = e.target.value;
    state.page = 0;
    loadTrips();
  });

  els.sortSelect?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.page = 0;
    loadTrips();
  });

  els.viewGrid?.addEventListener("click", () => {
    state.view = "grid";
    els.viewGrid.classList.add("active");
    els.viewList.classList.remove("active");
    renderTrips();
  });

  els.viewList?.addEventListener("click", () => {
    state.view = "list";
    els.viewList.classList.add("active");
    els.viewGrid.classList.remove("active");
    renderTrips();
  });
}

function updateCount() {
  const countEl = els.tripsCount;
  if (!countEl) return;
  if (state.total === 0) {
    countEl.textContent = "Нет поездок";
  } else {
    countEl.textContent = pluralize(
      state.total,
      "поездка",
      "поездки",
      "поездок",
    );
  }
}

function showSkeleton(show) {
  els.skeletonGrid.style.display = show ? "grid" : "none";
  if (show) {
    els.tripsGrid.style.display = "none";
    els.tripsList.style.display = "none";
    els.emptyState.style.display = "none";
    els.pagination.style.display = "none";
  }
}

function setLoading(btn, loading) {
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

function statusLabel(status) {
  const labels = {
    PLANNED: "Запланирована",
    ACTIVE: "В пути",
    COMPLETED: "Завершена",
  };
  return labels[status] || status;
}

function formatDateRange(start, end) {
  if (!start) return "";
  const fmt = (d) =>
    new Date(d).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return end ? `${fmt(start)} — ${fmt(end)}` : `с ${fmt(start)}`;
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

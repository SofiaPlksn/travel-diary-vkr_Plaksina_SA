router.init("trip-create.html");

const tripId = new URLSearchParams(window.location.search).get("id");
const isEdit = !!tripId;
let tags = [];

document.addEventListener("DOMContentLoaded", async () => {

  if (isEdit) {
    document.getElementById("pageTitle").textContent = "Редактировать поездку";
    document.getElementById("pageSubtitle").textContent =
      "Обновите информацию о поездке";
    document.title = "TravelDiary — Редактировать поездку";
    document.getElementById("deleteSection").style.display = "block";
    await loadTripData();
  }
  fillCountrySuggestions();
  bindEvents();

  document.getElementById("saveBtn").disabled = false;
});

async function loadTripData() {
  try {
    const trip = await api.get(`/api/trips/${tripId}`);
    fillForm(trip);
  } catch (err) {
    showToast("Ошибка загрузки поездки: " + err.message, "error");
    setTimeout(() => (window.location.href = "/trips.html"), 2000);
  }
}

function fillForm(trip) {
  document.getElementById("tripTitle").value = trip.title || "";
  document.getElementById("tripCountry").value = trip.country || "";
  document.getElementById("tripCity").value = trip.city || "";
  document.getElementById("tripDescription").value = trip.description || "";
  document.getElementById("startDate").value = trip.startDate || "";
  document.getElementById("endDate").value = trip.endDate || "";
  document.getElementById("tripStatus").value = trip.status || "PLANNED";
  document.getElementById("tripVisibility").value =
    trip.visibility || "PRIVATE";
  document.getElementById("tripBudget").value = trip.budget || "";

  tags = trip.tags || [];
  renderTags();

  updatePreview();
  updateDuration();
  updateVisibilityHint();
}

function bindEvents() {

  ["tripTitle", "tripCountry", "tripCity", "startDate", "endDate"].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener("input", updatePreview);
    },
  );

  document
    .getElementById("startDate")
    ?.addEventListener("change", updateDuration);
  document
    .getElementById("endDate")
    ?.addEventListener("change", updateDuration);
  document
    .getElementById("tripVisibility")
    ?.addEventListener("change", updateVisibilityHint);

  const tagsInput = document.getElementById("tagsInput");
  tagsInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagsInput.value.trim().replace(/,$/, ""));
    }
  });
  tagsInput?.addEventListener("blur", () => {
    if (tagsInput.value.trim()) addTag(tagsInput.value.trim());
  });

  document
    .querySelector(".tags-input-wrapper")
    ?.addEventListener("click", () => {
      tagsInput?.focus();
    });
  document.querySelectorAll(".quick-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      addTag(btn.dataset.tag);
    });
  });
  document
    .getElementById("saveBtn")
    ?.addEventListener("click", () => submitForm(false));
  document
    .getElementById("saveDraftBtn")
    ?.addEventListener("click", () => submitForm(true));
  document.getElementById("deleteBtn")?.addEventListener("click", deleteTrip);
}

async function submitForm(asDraft) {
  if (!validate()) return;

  const body = {
    title: document.getElementById("tripTitle").value.trim(),
    country: document.getElementById("tripCountry").value.trim(),
    city: document.getElementById("tripCity").value.trim() || null,
    description:
      document.getElementById("tripDescription").value.trim() || null,
    startDate: document.getElementById("startDate").value || null,
    endDate: document.getElementById("endDate").value || null,
    status: asDraft ? "PLANNED" : document.getElementById("tripStatus").value,
    visibility: document.getElementById("tripVisibility").value,
    budget: parseFloat(document.getElementById("tripBudget").value) || null,
    tags,
  };

  const btn = asDraft
    ? document.getElementById("saveDraftBtn")
    : document.getElementById("saveBtn");

  setLoading(btn, true);

  try {
    let result;
    if (isEdit) {
      result = await api.put(`/api/trips/${tripId}`, body);
    } else {
      result = await api.post("/api/trips", body);
    }

    showToast(isEdit ? "Поездка обновлена!" : "Поездка создана!", "success");
    setTimeout(() => {
      window.location.href = `/trip-detail.html?id=${result.id}`;
    }, 800);
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
    setLoading(btn, false);
  }
}

async function deleteTrip() {
  const title = document.getElementById("tripTitle").value;
  if (
    !confirm(
      `Удалить поездку "${title}"?\n\nВсе данные будут удалены безвозвратно.`,
    )
  )
    return;

  const btn = document.getElementById("deleteBtn");
  setLoading(btn, true);

  try {
    await api.delete(`/api/trips/${tripId}`);
    showToast("Поездка удалена", "success");
    setTimeout(() => (window.location.href = "/trips.html"), 1000);
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
    setLoading(btn, false);
  }
}

function addTag(value) {
  const tag = value.toLowerCase().trim();
  const input = document.getElementById("tagsInput");

  if (!tag || tags.includes(tag) || tags.length >= 10) {
    if (input) input.value = "";
    return;
  }

  tags.push(tag);
  renderTags();
  if (input) input.value = "";

  document.querySelectorAll(".quick-tag").forEach((btn) => {
    if (btn.dataset.tag === tag) btn.classList.add("added");
  });
}

function removeTag(tag) {
  tags = tags.filter((t) => t !== tag);
  renderTags();

  document.querySelectorAll(".quick-tag").forEach((btn) => {
    if (btn.dataset.tag === tag) btn.classList.remove("added");
  });
}

function renderTags() {
  const list = document.getElementById("tagsList");
  if (!list) return;

  list.innerHTML = tags
    .map(
      (tag) => `
    <span class="tag-chip">
      ${escapeHtml(tag)}
      <button class="tag-chip__remove" onclick="removeTag('${tag}')">✕</button>
    </span>
  `,
    )
    .join("");
}

function updatePreview() {
  const title =
    document.getElementById("tripTitle")?.value || "Название поездки";
  const country = document.getElementById("tripCountry")?.value || "";
  const city = document.getElementById("tripCity")?.value || "";
  const start = document.getElementById("startDate")?.value || "";
  const end = document.getElementById("endDate")?.value || "";

  document.getElementById("previewTitle").textContent =
    title || "Название поездки";

  document.getElementById("previewLocation").textContent =
    [city, getCountryName(country)].filter(Boolean).join(", ") ||
    "Страна, город";

  document.getElementById("previewDate").textContent = start
    ? formatDateRange(start, end)
    : "Дата не указана";

  document.getElementById("previewCover").textContent =
    getCountryEmoji(country);
}

function updateDuration() {
  const start = document.getElementById("startDate")?.value;
  const end = document.getElementById("endDate")?.value;
  const badge = document.getElementById("durationBadge");
  const text = document.getElementById("durationText");

  if (start && end && end >= start) {
    const days =
      Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
    text.textContent = pluralize(days, "день", "дня", "дней");
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

function updateVisibilityHint() {
  const hints = {
    PRIVATE: "Только вы можете видеть эту поездку",
    LINK_ONLY: "Доступна всем, у кого есть ссылка",
    PUBLIC: "Видна всем пользователям",
  };
  const sel = document.getElementById("tripVisibility")?.value;
  const hint = document.getElementById("visibilityHint");
  if (hint) hint.textContent = hints[sel] || "";
}

function fillCountrySuggestions() {
  const countries = [
    "Австралия",
    "Австрия",
    "Азербайджан",
    "Албания",
    "Алжир",
    "Андорра",
    "Аргентина",
    "Армения",
    "Беларусь",
    "Бельгия",
    "Болгария",
    "Боливия",
    "Бразилия",
    "Великобритания",
    "Венгрия",
    "Вьетнам",
    "Германия",
    "Греция",
    "Грузия",
    "Дания",
    "Египет",
    "Израиль",
    "Индия",
    "Индонезия",
    "Иордания",
    "Ирак",
    "Иран",
    "Ирландия",
    "Исландия",
    "Испания",
    "Италия",
    "Казахстан",
    "Камбоджа",
    "Канада",
    "Кения",
    "Китай",
    "Колумбия",
    "Латвия",
    "Ливан",
    "Литва",
    "Люксембург",
    "Малайзия",
    "Марокко",
    "Мексика",
    "Молдова",
    "Монако",
    "Нидерланды",
    "Новая Зеландия",
    "Норвегия",
    "ОАЭ",
    "Пакистан",
    "Перу",
    "Польша",
    "Португалия",
    "Россия",
    "Румыния",
    "Саудовская Аравия",
    "Сербия",
    "Сингапур",
    "Словакия",
    "Словения",
    "США",
    "Таиланд",
    "Турция",
    "Узбекистан",
    "Украина",
    "Филиппины",
    "Финляндия",
    "Франция",
    "Хорватия",
    "Черногория",
    "Чехия",
    "Чили",
    "Швейцария",
    "Швеция",
    "Эстония",
    "Южная Корея",
    "Япония",
  ];
  const dl = document.getElementById("countrySuggestions");
  if (dl) {
    dl.innerHTML = countries.map((c) => `<option value="${c}">`).join("");
  }
}

function validate() {
  let valid = true;

  const title = document.getElementById("tripTitle").value.trim();
  const country = document.getElementById("tripCountry").value.trim();
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!title) {
    setError("tripTitle", "titleError", "Введите название поездки");
    valid = false;
  } else clearError("tripTitle", "titleError");

  if (!country) {
    setError("tripCountry", "countryError", "Укажите страну");
    valid = false;
  } else clearError("tripCountry", "countryError");

  if (!start) {
    setError("startDate", "startDateError", "Укажите дату начала");
    valid = false;
  } else clearError("startDate", "startDateError");

  if (start && end && end < start) {
    setError(
      "endDate",
      "startDateError",
      "Дата окончания не может быть раньше начала",
    );
    valid = false;
  }

  return valid;
}

function setError(inputId, errorId, msg) {
  document.getElementById(inputId)?.classList.add("error");
  const el = document.getElementById(errorId);
  if (el) el.textContent = msg;
}
function clearError(inputId, errorId) {
  document.getElementById(inputId)?.classList.remove("error");
  const el = document.getElementById(errorId);
  if (el) el.textContent = "";
}
function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

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

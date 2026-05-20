router.init("profile.html");

let settingsEventsBound = false;

document.addEventListener("DOMContentLoaded", async () => {
  renderProfileHeader();
  initTabs();
  await loadStats();
});

function renderProfileHeader() {
  const user = auth.getUser();
  if (!user) return;

  const initialsEl = document.getElementById("profileAvatarInitials");
  const imgEl = document.getElementById("profileAvatarImg");

  if (user.avatarUrl) {
    imgEl.src = api.fileUrl(user.avatarUrl);
    imgEl.style.display = "block";
    initialsEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    initialsEl.style.display = "block";
    initialsEl.textContent = auth.getUserInitials();
  }

  document.getElementById("profileName").textContent =
    user.name || "Пользователь";
  document.getElementById("profileEmail").textContent = user.email || "";

  if (user.createdAt) {
    const since = new Date(user.createdAt).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    document.getElementById("profileSince").textContent =
      `В TravelDiary с ${since}`;
  }

  document.getElementById("settingsName").value = user.name || "";
  document.getElementById("settingsEmail").value = user.email || "";

  document.getElementById("editProfileBtn")?.addEventListener("click", () => {
    document.querySelector('.tab[data-tab="settings"]')?.click();
  });

  const avatarContainer = document.getElementById("profileAvatar");
  const avatarInput = document.getElementById("avatarInput");

  avatarContainer?.addEventListener("click", () => avatarInput.click());
  avatarInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) uploadAvatar(file);
  });
}

async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);

  const container = document.getElementById("profileAvatar");
  container.classList.add("loading-overlay");

  try {
    const updatedUser = await api.upload("/api/users/me/avatar", formData);
    auth.updateUser(updatedUser);
    renderProfileHeader();

    router.renderSidebar();

    showToast("Аватарка обновлена", "success");
  } catch (err) {
    showToast("Ошибка загрузки: " + err.message, "error");
  } finally {
    container.classList.remove("loading-overlay");
    document.getElementById("avatarInput").value = "";
  }
}

function initTabs() {
  document.querySelectorAll("#profileTabs .tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      document
        .querySelectorAll("#profileTabs .tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      document.getElementById(`panel-${name}`)?.classList.add("active");

      switch (name) {
        case "achievements":
          await loadAchievements();
          break;
        case "countries":
          await loadCountries();
          break;
        case "settings":
          bindSettingsEvents();
          break;
      }
    });
  });
}

async function loadStats() {
  try {
    const data = await api.get("/api/analytics");
    renderStatCards(data);
    renderCharts(data);
    renderTopCountries(data.topCountries || []);
  } catch (err) {
    showToast("Ошибка загрузки статистики: " + err.message, "error");
  }
}

function renderStatCards(data) {
  const metrics = [
    { icon: "🧭", value: data.totalTrips || 0, label: "Всего поездок" },
    { icon: "🌎", value: data.countriesVisited || 0, label: "Стран посещено" },
    { icon: "📸", value: data.totalMedia || 0, label: "Медиафайлов" },
    { icon: "📌", value: data.totalPlaces || 0, label: "Мест отмечено" },
    {
      icon: "📖",
      value: data.totalJournalEntries || 0,
      label: "Записей в дневнике",
    },
    { icon: "🌆", value: data.citiesVisited || 0, label: "Городов" },
    { icon: "🏆", value: data.completedTrips || 0, label: "Завершено" },
    { icon: "🚀", value: data.activeTrips || 0, label: "В пути" },
    { icon: "📅", value: data.plannedTrips || 0, label: "Запланировано" },
  ];

  document.getElementById("statsGrid").innerHTML = metrics
    .map(
      (m) => `
    <div class="stat-card fade-in">
      <div class="stat-card__icon">${m.icon}</div>
      <div class="stat-card__value">${m.value}</div>
      <div class="stat-card__label">${m.label}</div>
    </div>
  `,
    )
    .join("");
}

function renderCharts(data) {
  // График: статусы поездок
  const statusCtx = document.getElementById("statusChart")?.getContext("2d");
  if (statusCtx) {
    new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: ["Запланированы", "В пути", "Завершены"],
        datasets: [
          {
            data: [
              data.plannedTrips || 0,
              data.activeTrips || 0,
              data.completedTrips || 0,
            ],
            backgroundColor: ["#93c5fd", "#34d399", "#94a3b8"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 } } },
        },
        cutout: "65%",
      },
    });
  }

  const monthsCtx = document.getElementById("monthsChart")?.getContext("2d");
  if (monthsCtx && data.monthlyStats) {
    const labels = Object.keys(data.monthlyStats);
    const values = Object.values(data.monthlyStats);

    new Chart(monthsCtx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Поездок",
            data: values,
            backgroundColor: "#3b82f6",
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: "#f1f5f9" },
          },
          x: {
            ticks: { font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
  }
}

function renderTopCountries(countries) {
  const container = document.getElementById("topCountries");
  if (!countries.length) {
    container.innerHTML = '<p class="text-muted text-sm">Нет данных</p>';
    return;
  }
  const max = countries[0]?.tripsCount || 1;

  container.innerHTML = countries
    .map(
      (c) => `
    <div class="country-bar">
      <div class="country-bar__name">
        ${getCountryFlag(c.country)} ${escapeHtml(getCountryName(c.country))}
      </div>
      <div class="country-bar__track">
        <div class="country-bar__fill"
             style="width:${((c.tripsCount / max) * 100).toFixed(0)}%"></div>
      </div>
      <div class="country-bar__count">
        ${pluralize(c.tripsCount, "поездка", "поездки", "поездок")}
      </div>
    </div>
  `,
    )
    .join("");
}

async function loadAchievements() {
  const grid = document.getElementById("achievementsGrid");
  if (!grid.querySelector(".skeleton") && grid.children.length > 0) return;

  try {
    const data = await api.get("/api/analytics/achievements");
    renderAchievements(data);
  } catch (err) {
    showToast("Ошибка загрузки достижений: " + err.message, "error");
  }
}

function renderAchievements(achievements) {
  const grid = document.getElementById("achievementsGrid");
  const count = document.getElementById("achievementsCount");

  const unlocked = achievements.filter((a) => a.unlocked).length;
  count.textContent = `${unlocked} из ${achievements.length} разблокировано`;

  grid.innerHTML = achievements
    .map((a) => {
      const pct =
        a.target > 0
          ? Math.min((a.progress / a.target) * 100, 100).toFixed(0)
          : 0;

      return `
      <div class="achievement-card ${a.unlocked ? "unlocked" : "locked"} fade-in">
        <span class="achievement-card__emoji">${a.emoji || "🏅"}</span>
        <div class="achievement-card__title">${escapeHtml(a.title)}</div>
        <div class="achievement-card__desc">${escapeHtml(a.description)}</div>

        ${
          !a.unlocked && a.target > 0
            ? `
          <div class="achievement-progress">
            <div class="achievement-progress__fill" style="width:${pct}%"></div>
          </div>
          <div class="achievement-progress__label">${a.progress} / ${a.target}</div>
        `
            : ""
        }

        ${
          a.unlocked && a.unlockedAt
            ? `
          <div class="achievement-card__date">
            🏆 ${new Date(a.unlockedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
          </div>`
            : ""
        }
      </div>
    `;
    })
    .join("");
}

async function loadCountries() {
  const grid = document.getElementById("countriesGrid");
  if (!grid.querySelector(".skeleton") && grid.children.length > 0) return;

  try {
    const data = await api.get("/api/analytics");
    renderCountries(data.topCountries || []);
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

function renderCountries(countries) {
  const grid = document.getElementById("countriesGrid");
  if (!countries.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">🌍</span>
        <p class="empty-state__title">Нет посещённых стран</p>
        <p class="empty-state__text">Создайте поездку, чтобы добавить страну</p>
      </div>`;
    return;
  }

  grid.innerHTML = countries
    .map(
      (c) => `
    <div class="country-card fade-in">
      <div class="country-card__flag">${getCountryFlag(c.country)}</div>
      <div>
        <div class="country-card__name">${escapeHtml(getCountryName(c.country))}</div>
        <div class="country-card__count">
          ${pluralize(c.tripsCount, "поездка", "поездки", "поездок")}
          · ${c.placesCount || 0} мест
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function bindSettingsEvents() {
  if (settingsEventsBound) return;
  settingsEventsBound = true;

  document
    .getElementById("saveProfileBtn")
    ?.addEventListener("click", saveProfile);

  document
    .getElementById("changePasswordBtn")
    ?.addEventListener("click", changePassword);

  document
    .getElementById("logoutSettingsBtn")
    ?.addEventListener("click", () => {
      if (confirm("Выйти из аккаунта?")) auth.logout();
    });

  document
    .getElementById("deleteAccountBtn")
    ?.addEventListener("click", deleteAccount);
}

async function saveProfile() {
  const name = document.getElementById("settingsName").value.trim();
  const email = document.getElementById("settingsEmail").value.trim();

  if (!name || !email) {
    showToast("Заполните имя и email", "error");
    return;
  }

  const btn = document.getElementById("saveProfileBtn");
  setLoading(btn, true);

  try {
    const updated = await api.put("/api/users/me", { name, email });
    auth.updateUser(updated);

    document.getElementById("profileName").textContent = updated.name;
    document.getElementById("profileEmail").textContent = updated.email;
    document.getElementById("profileAvatar").textContent =
      auth.getUserInitials();

    router.renderSidebar("profile.html");

    showToast("Профиль обновлён", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
}

async function changePassword() {
  const current = document.getElementById("currentPassword").value;
  const newPwd = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmNewPassword").value;

  if (!current) {
    showToast("Введите текущий пароль", "error");
    return;
  }
  if (newPwd.length < 8) {
    showToast("Новый пароль — минимум 8 символов", "error");
    return;
  }
  if (newPwd !== confirm) {
    showToast("Пароли не совпадают", "error");
    return;
  }

  const btn = document.getElementById("changePasswordBtn");
  setLoading(btn, true);

  try {
    await api.post("/api/users/me/password", {
      currentPassword: current,
      newPassword: newPwd,
    });
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";
    showToast("Пароль изменён", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
}

async function deleteAccount() {
  const confirmed = confirm(
    "Удалить аккаунт без возможности восстановления?\n\nБудут удалены профиль, все поездки, дневник, медиафайлы и документы.",
  );
  if (!confirmed) return;

  const confirmationText = prompt("Для подтверждения введите: УДАЛИТЬ");
  if (confirmationText !== "УДАЛИТЬ") {
    showToast("Удаление аккаунта отменено", "info");
    return;
  }

  const btn = document.getElementById("deleteAccountBtn");
  setLoading(btn, true);

  try {
    await api.delete("/api/users/me");
    sessionStorage.removeItem("user");
    window.location.href = "/index.html";
  } catch (err) {
    showToast("Ошибка удаления аккаунта: " + err.message, "error");
    setLoading(btn, false);
  }
}

function setLoading(btn, loading) {
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function pluralize(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} ${one}`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return `${n} ${few}`;
  return `${n} ${many}`;
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

function getCountryFlag(code) {
  return "🌍";
}

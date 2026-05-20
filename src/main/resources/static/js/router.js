const router = (() => {
  const NAV_ITEMS = [
    {
      href: "trips.html",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>',
      label: "Мои поездки",
    },
    {
      href: "map-global.html",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      label: "Карта мира",
    },
    {
      href: "memories.html",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>',
      label: "Воспоминания",
    },
    {
      href: "trip-create.html",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      label: "Новая поездка",
    },
    {
      href: "profile.html",
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      label: "Профиль",
    },
  ];

  function requireAuth() {
    if (!auth.isAuthenticated()) {
      window.location.href = "/index.html";
    }
  }

  function renderSidebar(activePage) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const user = auth.getUser();
    const initials = auth.getUserInitials();

    const navItems = NAV_ITEMS.map(
      (item) => `
      <a href="/${item.href}"
         class="nav-item ${activePage === item.href ? "active" : ""}">
        <span class="nav-item__icon">${item.icon}</span>
        ${item.label}
      </a>
    `,
    ).join("");

    const avatarHtml = user?.avatarUrl
      ? `<img src="${api.fileUrl(user.avatarUrl)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
      : initials;

    sidebar.innerHTML = `

      <a href="/trips.html" class="sidebar__logo">
        <div class="sidebar__logo-icon">🗺️</div>
        <span class="sidebar__logo-text">TravelDiary</span>
      </a>
      
      <nav class="sidebar__nav">
        ${navItems}
      </nav>
      
      <div class="sidebar__footer">
        <div class="sidebar__user" id="userMenu">
          <div class="avatar avatar-sm">${avatarHtml}</div>
          <div class="sidebar__user-info">
            <div class="sidebar__user-name">${user?.name || "Пользователь"}</div>
            <div class="sidebar__user-email">${user?.email || ""}</div>
          </div>
          <button class="btn-ghost btn-icon" id="logoutBtn" title="Выйти">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Выйти из аккаунта?")) {
        auth.logout();
      }
    });
  }

  function ensureToastContainer() {
    if (!document.getElementById("toastContainer")) {
      const container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
  }

  function showToast(message, type = "info", duration = 4000) {
    ensureToastContainer();
    const container = document.getElementById("toastContainer");

    const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span class="toast__text">${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
    return toast;
  }

  function init(activePage) {
    requireAuth();
    document.addEventListener("DOMContentLoaded", () => {
      renderSidebar(activePage);
      ensureToastContainer();
    });
  }
  return {
    requireAuth,
    renderSidebar,
    showToast,
    ensureToastContainer,
    init,
  };
})();

function showToast(message, type = "info", duration = 4000) {
  return router.showToast(message, type, duration);
}

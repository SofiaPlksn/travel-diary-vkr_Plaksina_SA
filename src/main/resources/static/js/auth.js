const auth = {
  saveUser(user) {
    if (user) {
      sessionStorage.setItem("user", JSON.stringify(user));
    }
  },

  updateUser(user) {
    this.saveUser(user);
  },

  getUserInitials() {
    const user = this.getUser();
    if (!user || !user.name) return "?";
    return user.name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  },

  getUser() {
    const data = sessionStorage.getItem("user");
    return data ? JSON.parse(data) : null;
  },

  isAuthenticated() {
    return !!sessionStorage.getItem("user");
  },

  async checkSession() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });
      if (response.ok) {
        const user = await response.json();
        this.saveUser(user);
        return true;
      }

      sessionStorage.removeItem("user");
      return false;
    } catch {
      return false;
    }
  },

  handleAuthResponse(data) {
    if (data && data.user) {
      this.saveUser(data.user);
    }
  },

  async logout() {
    try {
      const csrfToken = getCookie("XSRF-TOKEN");

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {},
      });
    } catch (e) {
      console.warn("Logout request failed:", e);
    } finally {
      sessionStorage.removeItem("user");
      window.location.href = "/index.html";
    }
  },
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

window.auth = auth;

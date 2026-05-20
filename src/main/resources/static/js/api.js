const api = {
  async get(url) {
    return this._request(url, { method: "GET" });
  },

  async post(url, body) {
    return this._request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async put(url, body) {
    return this._request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async delete(url) {
    return this._request(url, { method: "DELETE" });
  },

  async postFile(url, formData) {
    return this._request(url, {
      method: "POST",
      body: formData,
    });
  },

  fileUrl(path) {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("/api/files/")) return path;

    const cleanPath = path.startsWith("/") ? path.substring(1) : path;
    return `/api/files/${cleanPath}`;
  },

  async upload(url, formData) {
    return this.postFile(url, formData);
  },

  async _request(url, options = {}) {
    options.credentials = "same-origin";

    if (options.method && options.method !== "GET") {
      const csrfToken = getCookie("XSRF-TOKEN");
      if (csrfToken) {
        options.headers = options.headers || {};
        options.headers["X-XSRF-TOKEN"] = csrfToken;
      }
    }

    const response = await fetch(url, options);
    if (response.status === 401) {
      if (!url.includes("/api/auth/me")) {
        sessionStorage.removeItem("user");
        window.location.href = "/index.html";
      }
      throw new Error("Требуется аутентификация");
    }
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || data.message || `Ошибка ${response.status}`,
        );
      }
      return data;
    }

    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}`);
    }
    return response;
  },
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

window.api = api;

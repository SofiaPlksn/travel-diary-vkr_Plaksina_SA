document.addEventListener("DOMContentLoaded", () => {
  if (auth.isAuthenticated()) {
    window.location.href = "/trips.html";
    return;
  }

  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  // ── Переключение вкладок ──
  tabLogin.addEventListener("click", () => showTab("login"));
  tabRegister.addEventListener("click", () => showTab("register"));

  function showTab(tab) {
    const isLogin = tab === "login";
    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);
    loginForm.style.display = isLogin ? "block" : "none";
    registerForm.style.display = isLogin ? "none" : "block";
    clearAllErrors();
  }

  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  document.getElementById("regPassword")?.addEventListener("input", (e) => {
    updatePasswordStrength(e.target.value);
  });

  function updatePasswordStrength(password) {
    const indicator = document.getElementById("passwordStrength");
    const fill = document.getElementById("strengthFill");
    const label = document.getElementById("strengthLabel");

    if (!password) {
      indicator.style.display = "none";
      return;
    }

    indicator.style.display = "block";

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;

    const levels = [
      { pct: "20%", color: "#dc2626", text: "Очень слабый" },
      { pct: "40%", color: "#f97316", text: "Слабый" },
      { pct: "60%", color: "#d97706", text: "Средний" },
      { pct: "80%", color: "#16a34a", text: "Хороший" },
      { pct: "100%", color: "#15803d", text: "Отличный" },
    ];

    const level = levels[Math.min(score - 1, 4)] || levels[0];
    fill.style.width = level.pct;
    fill.style.background = level.color;
    label.textContent = level.text;
    label.style.color = level.color;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    const btn = document.getElementById("loginBtn");
    setLoading(btn, true);
    clearError("loginError");

    try {
      const response = await api.post("/api/auth/login", {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value,
      });

      auth.handleAuthResponse(response);
      if (response.emailConfirmationLink) {
        sessionStorage.setItem("emailConfirmationLink", response.emailConfirmationLink);
      }
      window.location.href = "/trips.html";
    } catch (err) {
      showError("loginError", err.message || "Неверный email или пароль");
    } finally {
      setLoading(btn, false);
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    const btn = document.getElementById("registerBtn");
    setLoading(btn, true);
    clearError("registerError");

    try {
      const response = await api.post("/api/auth/register", {
        name: document.getElementById("regName").value.trim(),
        email: document.getElementById("regEmail").value.trim(),
        password: document.getElementById("regPassword").value,
      });

      auth.handleAuthResponse(response);
      if (response.emailConfirmationLink) {
        sessionStorage.setItem("emailConfirmationLink", response.emailConfirmationLink);
      }
      window.location.href = "/trips.html";
    } catch (err) {
      showError("registerError", err.message || "Ошибка при регистрации");
    } finally {
      setLoading(btn, false);
    }
  });

  function validateLoginForm() {
    let valid = true;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(
        "loginEmail",
        "loginEmailError",
        "Введите корректный email",
      );
      valid = false;
    } else clearFieldError("loginEmail", "loginEmailError");

    if (!password) {
      setFieldError("loginPassword", "loginPasswordError", "Введите пароль");
      valid = false;
    } else clearFieldError("loginPassword", "loginPasswordError");

    return valid;
  }

  function validateRegisterForm() {
    let valid = true;
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regPasswordConfirm").value;

    if (!name || name.length < 2) {
      setFieldError(
        "regName",
        "regNameError",
        "Введите имя (минимум 2 символа)",
      );
      valid = false;
    } else clearFieldError("regName", "regNameError");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError("regEmail", "regEmailError", "Введите корректный email");
      valid = false;
    } else clearFieldError("regEmail", "regEmailError");

    if (!password || password.length < 8) {
      setFieldError(
        "regPassword",
        "regPasswordError",
        "Пароль — минимум 8 символов",
      );
      valid = false;
    } else clearFieldError("regPassword", "regPasswordError");

    if (password !== confirm) {
      setFieldError(
        "regPasswordConfirm",
        "regPasswordConfirmError",
        "Пароли не совпадают",
      );
      valid = false;
    } else clearFieldError("regPasswordConfirm", "regPasswordConfirmError");

    return valid;
  }

  const forgotModal = document.getElementById("forgotModal");

  document
    .getElementById("forgotPasswordLink")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      forgotModal.classList.add("open");
      document.getElementById("forgotEmail").value =
        document.getElementById("loginEmail").value;
    });

  document
    .getElementById("closeForgotModal")
    ?.addEventListener("click", closeForgotModal);
  document
    .getElementById("cancelForgot")
    ?.addEventListener("click", closeForgotModal);

  forgotModal.addEventListener("click", (e) => {
    if (e.target === forgotModal) closeForgotModal();
  });

  function closeForgotModal() {
    forgotModal.classList.remove("open");
    clearError("forgotEmailError");
  }

  document
    .getElementById("submitForgot")
    ?.addEventListener("click", async () => {
      const email = document.getElementById("forgotEmail").value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById("forgotEmailError").textContent =
          "Введите корректный email";
        return;
      }

      const btn = document.getElementById("submitForgot");
      setLoading(btn, true);

      try {
        const response = await api.post("/api/auth/forgot-password", { email });
        closeForgotModal();
        if (response.resetLink) {
          window.location.href = response.resetLink;
          return;
        }
        // (router не подключён на странице логина, используем alert)
        alert("Инструкции отправлены на " + email);
      } catch {
        document.getElementById("forgotEmailError").textContent =
          "Ошибка. Попробуйте позже.";
      } finally {
        setLoading(btn, false);
      }
    });

  function setLoading(btn, loading) {
    btn.classList.toggle("loading", loading);
    btn.disabled = loading;
  }

  function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId)?.classList.add("error");
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(inputId, errorId) {
    document.getElementById(inputId)?.classList.remove("error");
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = "";
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.style.display = "block";
    }
  }

  function clearError(id) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "";
      el.style.display = "none";
    }
  }

  function clearAllErrors() {
    document
      .querySelectorAll(".form-error")
      .forEach((el) => (el.textContent = ""));
    document
      .querySelectorAll(".form-input.error")
      .forEach((el) => el.classList.remove("error"));
    clearError("loginError");
    clearError("registerError");
  }
});

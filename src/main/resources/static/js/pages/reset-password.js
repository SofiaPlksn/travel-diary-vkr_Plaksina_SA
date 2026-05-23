document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const form = document.getElementById("resetPasswordForm");
  const messageEl = document.getElementById("resetPasswordMessage");

  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  if (!token) {
    showMessage("Ссылка сброса пароля некорректна или устарела.", "error");
    form.querySelectorAll("input, button[type='submit']").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!validate(newPassword, confirmPassword)) {
      return;
    }

    const btn = document.getElementById("resetPasswordBtn");
    setLoading(btn, true);

    try {
      await api.post("/api/auth/reset-password", { token, newPassword });
      showMessage("Пароль успешно изменён. Теперь можно войти с новым паролем.", "success");
      form.querySelectorAll("input, button[type='submit']").forEach((el) => {
        el.disabled = true;
      });
    } catch (err) {
      showMessage(err.message || "Не удалось изменить пароль.", "error");
    } finally {
      setLoading(btn, false);
    }
  });

  function validate(newPassword, confirmPassword) {
    let valid = true;
    if (!newPassword || newPassword.length < 8) {
      setFieldError("newPassword", "newPasswordError", "Пароль должен быть не короче 8 символов");
      valid = false;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("confirmPassword", "confirmPasswordError", "Пароли не совпадают");
      valid = false;
    }
    return valid;
  }

  function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId)?.classList.add("error");
    document.getElementById(errorId).textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll(".form-error").forEach((el) => {
      el.textContent = "";
    });
    document.querySelectorAll(".form-input.error").forEach((el) => {
      el.classList.remove("error");
    });
    messageEl.style.display = "none";
  }

  function showMessage(message, type) {
    messageEl.textContent = message;
    messageEl.style.display = "block";
    messageEl.classList.toggle("success", type === "success");
  }

  function setLoading(btn, loading) {
    btn.classList.toggle("loading", loading);
    btn.disabled = loading;
  }
});

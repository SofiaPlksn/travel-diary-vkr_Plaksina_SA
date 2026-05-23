document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const textEl = document.getElementById("confirmEmailText");
  const messageEl = document.getElementById("confirmEmailMessage");
  const tripsBtn = document.getElementById("confirmEmailTripsBtn");

  if (!token) {
    showResult("Ссылка подтверждения некорректна или устарела.", false);
    return;
  }

  try {
    await api.get(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`);
    const user = auth.getUser();
    if (user) {
      user.emailConfirmed = true;
      auth.updateUser(user);
      tripsBtn.style.display = "block";
    }
    sessionStorage.removeItem("emailConfirmationLink");
    showResult("Email успешно подтверждён.", true);
  } catch (err) {
    showResult(err.message || "Не удалось подтвердить email.", false);
  }

  function showResult(message, success) {
    textEl.textContent = success
      ? "Аккаунт обновлён, статус email сохранён в профиле."
      : "Проверьте ссылку или запросите подтверждение заново.";
    messageEl.textContent = message;
    messageEl.style.display = "block";
    messageEl.classList.toggle("success", success);
  }
});

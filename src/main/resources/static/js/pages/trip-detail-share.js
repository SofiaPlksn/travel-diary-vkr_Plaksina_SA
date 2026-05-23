function bindHeaderActions() {
  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    document.getElementById("shareModal").classList.add("open");
    if (typeof switchShareTab === "function") switchShareTab("share-link-tab");

    const isPublic =
      trip.visibility === "LINK_ONLY" || trip.visibility === "PUBLIC";
    document.getElementById("shareToggle").checked = isPublic;

    if (isPublic && trip.shareToken) {
      await displayShareLink(trip.shareToken);
    } else {
      document.getElementById("shareLinkContainer").style.display = "none";
    }
  });

  async function displayShareLink(token) {
    let host = window.location.host;
    try {
      const res = await fetch("/api/system/ip");
      if (res.ok) {
        const data = await res.json();
        const port = window.location.port ? ":" + window.location.port : "";
        host = data.ip + port;
      }
    } catch (e) {}

    const shareUrl = `${window.location.protocol}//${host}/share.html?token=${token}`;
    document.getElementById("shareLink").value = shareUrl;
    document.getElementById("shareLinkContainer").style.display = "flex";

    document.getElementById("qrcode").innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(document.getElementById("qrcode"), {
        text: shareUrl,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L,
      });
    }
  }

  document
    .getElementById("shareToggle")
    ?.addEventListener("change", async (e) => {
      const isPublic = e.target.checked;
      e.target.disabled = true;

      try {
        const newVisibility = isPublic ? "LINK_ONLY" : "PRIVATE";
        const updatedTrip = await api.put(`/api/trips/${tripId}`, {
          visibility: newVisibility,
        });

        trip.visibility = updatedTrip.visibility;
        trip.shareToken = updatedTrip.shareToken;
        renderHeader();

        if (isPublic && trip.shareToken) {
          await displayShareLink(trip.shareToken);
        } else {
          document.getElementById("shareLinkContainer").style.display = "none";
        }
      } catch (err) {
        showToast("Ошибка изменения прав доступа: " + err.message, "error");
        e.target.checked = !isPublic;
      } finally {
        e.target.disabled = false;
      }
    });

  document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
    const input = document.getElementById("shareLink");
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      showToast("Ссылка скопирована!", "success");
    });
  });

  document
    .getElementById("downloadPdfBtn")
    ?.addEventListener("click", async () => {
      const sections = [];
      if (document.getElementById("pdfDescription")?.checked)
        sections.push("description");
      if (document.getElementById("pdfPlaces")?.checked)
        sections.push("places");
      if (document.getElementById("pdfJournal")?.checked)
        sections.push("journal");

      if (sections.length === 0) {
        showToast("Выберите хотя бы один раздел", "error");
        return;
      }

      const btn = document.getElementById("downloadPdfBtn");
      const originalText = btn.textContent;
      btn.textContent = "⏳ Генерация...";
      btn.disabled = true;

      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(
          `/api/trips/${tripId}/pdf?sections=${sections.join(",")}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );

        if (!response.ok) throw new Error("Ошибка генерации PDF");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trip-${tripId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        document.getElementById("shareModal").classList.remove("open");
        showToast("PDF скачан!", "success");
      } catch (err) {
        showToast("Ошибка: " + err.message, "error");
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
    }
  });
}

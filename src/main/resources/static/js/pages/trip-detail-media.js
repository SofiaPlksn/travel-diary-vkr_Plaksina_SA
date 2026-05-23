let mediaList = [];
let mediaIndex = 0;

async function loadMedia() {
  try {
    mediaList = await api.get(`/api/trips/${tripId}/media`);
    renderMediaGrid();
  } catch (err) {
    showToast("Ошибка загрузки медиа: " + err.message, "error");
  }
}

function isVideo(media) {
  return media.contentType && media.contentType.startsWith("video/");
}

function renderMediaGrid() {
  const grid = document.getElementById("mediaGrid");

  if (mediaList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">🖼️</span>
        <p class="empty-state__title">Галерея пуста</p>
        <p class="empty-state__text">Загрузите фото или видео из поездки</p>
      </div>`;
    return;
  }

  grid.innerHTML = mediaList
    .map((media, idx) => {
      const videoItem = isVideo(media);
      const mediaHtml = videoItem
        ? `<div class="media-item__video-thumb">
           <video src="${api.fileUrl(media.fileUrl)}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>
           <span class="media-item__video-badge">▶ Видео</span>
         </div>`
        : `<img src="${api.fileUrl(media.thumbnailUrl || media.fileUrl)}"
             alt="${escapeHtml(media.caption || "")}"
             loading="lazy">`;
      return `
    <div class="media-item fade-in" data-index="${idx}">
      ${mediaHtml}
      ${media.exifLatitude ? `<span class="media-item__exif">📍 GPS</span>` : ""}
      <div class="media-item__overlay">
        <div class="media-item__actions">
          ${!videoItem ? `<button class="media-item__btn" onclick="openMediaEditModal(${idx})" title="Редактировать">✏️</button>` : ""}
          <button class="media-item__btn" onclick="openMediaModal(${idx})" title="Просмотр">🔍</button>
          <button class="media-item__btn" onclick="deleteMedia(${media.id})" title="Удалить">🗑️</button>
        </div>
        ${media.caption ? `<div class="media-item__caption">${escapeHtml(media.caption)}</div>` : ""}
        ${media.exifDate ? `<div class="media-item__caption" style="opacity:.7">${media.exifDate.substring(0, 10)}</div>` : ""}
      </div>
    </div>
  `;
    })
    .join("");
}

async function uploadFiles(files, endpoint, label) {
  if (!files.length) return;

  const progress = document.getElementById("uploadProgress");
  const fill = document.getElementById("uploadFill");
  const status = document.getElementById("uploadStatus");
  progress.style.display = "flex";

  let uploaded = 0;
  for (const file of files) {
    status.textContent = `Загрузка ${uploaded + 1} из ${files.length}...`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.upload(endpoint, formData);
      uploaded++;
      fill.style.width = `${(uploaded / files.length) * 100}%`;
    } catch (err) {
      showToast(`Ошибка загрузки ${file.name}: ${err.message}`, "error");
    }
  }

  progress.style.display = "none";
  fill.style.width = "0%";
  await loadMedia();
  await loadTrip(); // обновляем счётчики в шапке
  showToast(`Загружено ${uploaded} ${label}`, "success");
}

document
  .getElementById("mediaImageUpload")
  ?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    await uploadFiles(files, `/api/trips/${tripId}/media/photo`, "фото");
  });

document
  .getElementById("mediaVideoUpload")
  ?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    await uploadFiles(files, `/api/trips/${tripId}/media/video`, "видео");
  });

async function loadTripFiles() {
  try {
    const tripFiles = await api.get(`/api/trips/${tripId}/files`);
    renderTripFiles(tripFiles);
  } catch (err) {
    showToast("Ошибка загрузки файлов: " + err.message, "error");
  }
}

function renderTripFiles(tripFiles) {
  const list = document.getElementById("filesList");

  if (tripFiles.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">📄</span>
        <p class="empty-state__title">Нет загруженных файлов</p>
        <p class="empty-state__text">Загрузите билеты, брони или PDF документы</p>
      </div>`;
    return;
  }

  list.innerHTML = tripFiles
    .map((file) => {
      // Выбираем иконку по расширению
      const ext = file.originalFileName.split(".").pop().toLowerCase();
      let icon = "📄";
      if (ext === "pdf") icon = "📕";
      if (ext === "doc" || ext === "docx") icon = "📘";
      if (ext === "xls" || ext === "xlsx" || ext === "csv") icon = "📗";
      if (ext === "txt") icon = "📓";

      const sizeFormatted = (file.fileSize / 1024 / 1024).toFixed(2) + " MB";
      const dateFormatted = new Date(file.createdAt).toLocaleDateString(
        "ru-RU",
      );

      return `
      <div class="place-item fade-in" style="align-items: center">
        <div class="place-item__icon" style="background:var(--color-surface-2)">${icon}</div>
        <div class="place-item__info">
          <div class="place-item__name">${escapeHtml(file.originalFileName)}</div>
          <div class="place-item__address">${sizeFormatted} • Загружено: ${dateFormatted}</div>
        </div>
        <div class="place-item__actions">
          <a href="${api.fileUrl(file.fileUrl)}" download="${escapeHtml(file.originalFileName)}" target="_blank" class="btn-ghost btn-icon" title="Скачать">📥</a>
          <button class="btn-ghost btn-icon" onclick="deleteTripFile(${file.id})" title="Удалить">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

document.getElementById("fileUpload")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  e.target.value = "";

  const progress = document.getElementById("fileUploadProgress");
  const fill = document.getElementById("fileUploadFill");
  const status = document.getElementById("fileUploadStatus");
  progress.style.display = "flex";

  let uploaded = 0;
  for (const file of files) {
    status.textContent = `Загрузка ${uploaded + 1} из ${files.length}...`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.upload(`/api/trips/${tripId}/files`, formData);
      uploaded++;
      fill.style.width = `${(uploaded / files.length) * 100}%`;
    } catch (err) {
      showToast(`Ошибка загрузки ${file.name}: ${err.message}`, "error");
    }
  }

  progress.style.display = "none";
  fill.style.width = "0%";
  await loadTripFiles();
  await loadTrip();
  showToast(`Загружено ${uploaded} файлов`, "success");
});

async function deleteTripFile(fileId) {
  if (!confirm("Удалить файл?")) return;
  try {
    const btn = event?.currentTarget;
    if (btn) btn.disabled = true;

    await api.delete(`/api/trips/${tripId}/files/${fileId}`);
    showToast("Файл удалён", "success");
    await loadTripFiles();
    await loadTrip();
  } catch (err) {
    showToast("Ошибка удаления файла: " + err.message, "error");
  }
}

function openMediaModal(idx) {
  mediaIndex = idx;
  renderMediaViewer();
  document.getElementById("mediaModal").classList.add("open");
}

function closeMediaModal() {
  const videoEl = document.getElementById("mediaViewerVideo");
  if (videoEl) {
    videoEl.pause();
    videoEl.src = "";
  }
  document.getElementById("mediaModal").classList.remove("open");
}

function renderMediaViewer() {
  const media = mediaList[mediaIndex];
  const imgEl = document.getElementById("mediaViewerImg");
  const videoEl = document.getElementById("mediaViewerVideo");

  if (isVideo(media)) {
    imgEl.style.display = "none";
    videoEl.style.display = "block";
    videoEl.src = api.fileUrl(media.fileUrl);
    videoEl.load();
  } else {
    videoEl.style.display = "none";
    videoEl.src = "";
    imgEl.style.display = "block";
    imgEl.src = api.fileUrl(media.fileUrl);
  }

  document.getElementById("mediaViewerCaption").textContent =
    media.caption || (media.exifDate ? media.exifDate.substring(0, 10) : "");
  document.getElementById("mediaPrev").style.visibility =
    mediaIndex > 0 ? "visible" : "hidden";
  document.getElementById("mediaNext").style.visibility =
    mediaIndex < mediaList.length - 1 ? "visible" : "hidden";
}

document.getElementById("mediaPrev")?.addEventListener("click", () => {
  if (mediaIndex > 0) {
    mediaIndex--;
    renderMediaViewer();
  }
});
document.getElementById("mediaNext")?.addEventListener("click", () => {
  if (mediaIndex < mediaList.length - 1) {
    mediaIndex++;
    renderMediaViewer();
  }
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("mediaModal");
  if (!modal.classList.contains("open")) return;
  if (e.key === "ArrowLeft") {
    if (mediaIndex > 0) {
      mediaIndex--;
      renderMediaViewer();
    }
  }
  if (e.key === "ArrowRight") {
    if (mediaIndex < mediaList.length - 1) {
      mediaIndex++;
      renderMediaViewer();
    }
  }
  if (e.key === "Escape") closeMediaModal();
});

async function deleteMedia(id) {
  const media = mediaList.find((p) => p.id === id);
  if (!media) return;
  const isVid = isVideo(media);
  const promptName = isVid ? "видео" : "фотографию";
  const toastName = isVid ? "Видео удалено" : "Медиа удалено";

  if (!confirm(`Удалить ${promptName}?`)) return;
  try {
    await api.delete(`/api/trips/${tripId}/media/${id}`);
    await loadMedia();
    await loadTrip();
    showToast(toastName, "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

let editingMediaIndex = null;

function openMediaEditModal(idx) {
  editingMediaIndex = idx;
  const media = mediaList[idx];

  document.getElementById("editMediaPreview").src = api.fileUrl(
    media.thumbnailUrl || media.fileUrl,
  );
  document.getElementById("mediaCaption").value = media.caption || "";
  document.getElementById("mediaAddress").value = "";
  document.getElementById("mediaLat").value = media.exifLatitude || "";
  document.getElementById("mediaLon").value = media.exifLongitude || "";

  const badge = document.getElementById("mediaCoordsBadge");
  const text = document.getElementById("mediaCoordsText");
  if (badge && text) {
    if (media.exifLatitude && media.exifLongitude) {
      text.textContent = `${media.exifLatitude.toFixed(4)}, ${media.exifLongitude.toFixed(4)}`;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  const box = document.getElementById("mediaAddressSuggestions");
  if (box) box.style.display = "none";

  document.getElementById("mediaEditModal").classList.add("open");
}

function closeMediaEditModal() {
  document.getElementById("mediaEditModal").classList.remove("open");
  editingMediaIndex = null;
}

let mediaAddressDebounce = null;
document.getElementById("mediaAddress")?.addEventListener("input", () => {
  clearTimeout(mediaAddressDebounce);
  const q = document.getElementById("mediaAddress").value.trim();
  const box = document.getElementById("mediaAddressSuggestions");
  if (q.length < 3) {
    box.style.display = "none";
    return;
  }
  mediaAddressDebounce = setTimeout(
    () => fetchMediaAddressSuggestions(q, box),
    400,
  );
});

async function fetchMediaAddressSuggestions(query, box) {
  try {
    const results = await api.get(
      `/api/weather/geocode?q=${encodeURIComponent(query)}`,
    );
    if (!results.length) {
      box.style.display = "none";
      return;
    }
    box.innerHTML = results
      .map(
        (r) => `
      <div class="geocode-item"
           data-lat="${r.lat}" data-lon="${r.lon}"
           data-name="${escapeHtml(r.displayName)}">
        📍 ${escapeHtml(r.displayName)}
      </div>`,
      )
      .join("");
    box.style.display = "block";

    box.querySelectorAll(".geocode-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.getElementById("mediaAddress").value = item.dataset.name;
        document.getElementById("mediaLat").value = item.dataset.lat;
        document.getElementById("mediaLon").value = item.dataset.lon;

        const badge = document.getElementById("mediaCoordsBadge");
        const text = document.getElementById("mediaCoordsText");
        if (badge && text) {
          text.textContent = `${parseFloat(item.dataset.lat).toFixed(4)}, ${parseFloat(item.dataset.lon).toFixed(4)}`;
          badge.style.display = "flex";
        }
        box.style.display = "none";
      });
    });
  } catch {
    box.style.display = "none";
  }
}

document.addEventListener("click", (e) => {
  const box = document.getElementById("mediaAddressSuggestions");
  const input = document.getElementById("mediaAddress");
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = "none";
  }
});

function clearMediaCoords() {
  document.getElementById("mediaLat").value = "";
  document.getElementById("mediaLon").value = "";
  document.getElementById("mediaAddress").value = "";
  const badge = document.getElementById("mediaCoordsBadge");
  if (badge) badge.style.display = "none";
}

document
  .getElementById("saveMediaEditBtn")
  ?.addEventListener("click", async () => {
    if (editingMediaIndex === null) return;
    const media = mediaList[editingMediaIndex];

    const caption = document.getElementById("mediaCaption").value.trim();
    const latVal = document.getElementById("mediaLat").value;
    const lonVal = document.getElementById("mediaLon").value;

    const body = {
      caption: caption || null,
      latitude: latVal ? parseFloat(latVal) : null,
      longitude: lonVal ? parseFloat(lonVal) : null,
    };

    const btn = document.getElementById("saveMediaEditBtn");
    setLoading(btn, true);

    try {
      await api.put(`/api/trips/${tripId}/media/${media.id}`, body);
      closeMediaEditModal();
      await loadMedia();
      if (map) {
        map.remove();
        map = null;
        initMap();
      }
      showToast("Медиафайл обновлён", "success");
    } catch (err) {
      showToast("Ошибка: " + err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

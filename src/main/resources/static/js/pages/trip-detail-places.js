let editingPlace = null;
let placeRating = 0;

async function loadPlaces() {
  try {
    const places = await api.get(`/api/trips/${tripId}/places`);
    renderPlaces(places);
  } catch (err) {
    showToast("Ошибка загрузки мест: " + err.message, "error");
  }
}

function renderPlaces(places) {
  const list = document.getElementById("placesList");

  if (places.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">📍</span>
        <p class="empty-state__title">Нет мест</p>
        <p class="empty-state__text">Добавьте места, которые вы посетили</p>
      </div>`;
    return;
  }

  list.innerHTML = places
    .map(
      (place) => `
    <div class="place-item fade-in">
      <div class="place-item__icon">${categoryIcon(place.category)}</div>
      <div class="place-item__info">
        <div class="place-item__name">
          ${escapeHtml(place.name)}
          ${place.rating ? `<span style="color:#f59e0b;margin-left:8px">${"★".repeat(place.rating)}</span>` : ""}
        </div>
        ${place.address ? `<div class="place-item__address">📍 ${escapeHtml(place.address)}</div>` : ""}
        ${place.note ? `<div class="place-item__note">${escapeHtml(place.note)}</div>` : ""}
      </div>
      <div class="place-item__actions">
        <button class="btn btn-ghost btn-icon" onclick="openPlaceModal(${JSON.stringify(place).replace(/"/g, "&quot;")})">✏️</button>
        <button class="btn btn-ghost btn-icon" onclick="deletePlace(${place.id})">🗑️</button>
      </div>
    </div>
  `,
    )
    .join("");
}

document
  .getElementById("addPlaceBtn")
  ?.addEventListener("click", () => openPlaceModal(null));

let addressDebounce = null;
document.getElementById("placeAddress")?.addEventListener("input", () => {
  clearTimeout(addressDebounce);
  const q = document.getElementById("placeAddress").value.trim();
  const box = document.getElementById("addressSuggestions");
  if (q.length < 3) {
    box.style.display = "none";
    return;
  }
  addressDebounce = setTimeout(() => fetchAddressSuggestions(q, box), 400);
});

document.addEventListener("click", (e) => {
  const box = document.getElementById("addressSuggestions");
  const input = document.getElementById("placeAddress");
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = "none";
  }
});

async function fetchAddressSuggestions(query, box) {
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
        document.getElementById("placeAddress").value = item.dataset.name;
        document.getElementById("placeLat").value = item.dataset.lat;
        document.getElementById("placeLon").value = item.dataset.lon;
        // Показываем бейдж с координатами
        const badge = document.getElementById("placeCoordsBadge");
        const text = document.getElementById("placeCoordsText");
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

function clearPlaceCoords() {
  document.getElementById("placeLat").value = "";
  document.getElementById("placeLon").value = "";
  const badge = document.getElementById("placeCoordsBadge");
  if (badge) badge.style.display = "none";
}

function openPlaceModal(place) {
  editingPlace = place;
  placeRating = place?.rating || 0;

  document.getElementById("placeModalTitle").textContent = place
    ? "Редактировать место"
    : "Добавить место";
  document.getElementById("placeName").value = place?.name || "";
  document.getElementById("placeCategory").value =
    place?.category || "ATTRACTION";
  document.getElementById("placeAddress").value = place?.address || "";
  document.getElementById("placeLat").value = place?.latitude || "";
  document.getElementById("placeLon").value = place?.longitude || "";
  document.getElementById("placeNote").value = place?.note || "";

  const badge = document.getElementById("placeCoordsBadge");
  const text = document.getElementById("placeCoordsText");
  if (badge && text) {
    if (place?.latitude && place?.longitude) {
      text.textContent = `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  const box = document.getElementById("addressSuggestions");
  if (box) box.style.display = "none";

  renderStars(placeRating);
  document.getElementById("placeModal").classList.add("open");
}

function closePlaceModal() {
  document.getElementById("placeModal").classList.remove("open");
  editingPlace = null;
}

document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    placeRating = parseInt(star.dataset.value);
    renderStars(placeRating);
  });
  star.addEventListener("mouseover", () => {
    const val = parseInt(star.dataset.value);
    document.querySelectorAll(".star").forEach((s) => {
      s.classList.toggle("hovered", parseInt(s.dataset.value) <= val);
    });
  });
  star.addEventListener("mouseleave", () => {
    document
      .querySelectorAll(".star")
      .forEach((s) => s.classList.remove("hovered"));
  });
});

function renderStars(rating) {
  document.querySelectorAll(".star").forEach((s) => {
    s.classList.toggle("active", parseInt(s.dataset.value) <= rating);
  });
}

document.getElementById("savePlaceBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("placeName").value.trim();
  if (!name) {
    showToast("Введите название места", "error");
    return;
  }

  const body = {
    name,
    category: document.getElementById("placeCategory").value,
    address: document.getElementById("placeAddress").value.trim() || null,
    latitude: parseFloat(document.getElementById("placeLat").value) || null,
    longitude: parseFloat(document.getElementById("placeLon").value) || null,
    note: document.getElementById("placeNote").value.trim() || null,
    rating: placeRating || null,
  };

  const btn = document.getElementById("savePlaceBtn");
  setLoading(btn, true);

  try {
    if (editingPlace) {
      await api.put(`/api/trips/${tripId}/places/${editingPlace.id}`, body);
    } else {
      await api.post(`/api/trips/${tripId}/places`, body);
    }
    closePlaceModal();
    await loadPlaces();
    await loadTrip();
    if (map) {
      map.remove();
      map = null;
    }
    showToast(editingPlace ? "Место обновлено" : "Место добавлено", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

async function deletePlace(id) {
  if (!confirm("Удалить место?")) return;
  try {
    await api.delete(`/api/trips/${tripId}/places/${id}`);
    await loadPlaces();
    await loadTrip();
    showToast("Место удалено", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

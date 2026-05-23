let editingEntry = null;

async function loadJournal() {
  try {
    const entries = await api.get(`/api/trips/${tripId}/journal`);
    renderJournal(entries);
  } catch (err) {
    showToast("Ошибка загрузки дневника: " + err.message, "error");
  }
}

function renderJournal(entries) {
  const list = document.getElementById("journalList");

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">✍️</span>
        <p class="empty-state__title">Дневник пуст</p>
        <p class="empty-state__text">Запишите впечатления о сегодняшнем дне</p>
      </div>`;
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `
    <div class="journal-item fade-in">
      <div class="journal-item__header">
        <span class="journal-item__mood">${moodEmoji(entry.mood)}</span>
        <div class="journal-item__title">${escapeHtml(entry.title)}</div>
        <span class="journal-item__date">${entry.entryDate ? formatDate(entry.entryDate) : ""}</span>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-icon"
                  onclick='openJournalModal(${JSON.stringify(entry).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-ghost btn-icon" onclick="deleteEntry(${entry.id})">🗑️</button>
        </div>
      </div>
      <div class="journal-item__body" id="entry-body-${entry.id}">
        ${entry.content ? entry.content.replace(/<[^>]+>/g, "") : ""}
      </div>
      <div class="journal-item__footer">
        <span class="text-sm text-muted">${entry.content?.length > 200 ? "..." : ""}</span>
        ${
          (entry.content?.replace(/<[^>]+>/g, "").length || 0) > 200
            ? `
          <button class="btn btn-ghost btn-sm"
                  onclick="toggleEntry('${entry.id}')">Читать полностью</button>`
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");
}

function toggleEntry(id) {
  const body = document.getElementById(`entry-body-${id}`);
  body.classList.toggle("expanded");
}

document
  .getElementById("addJournalBtn")
  ?.addEventListener("click", () => openJournalModal(null));

function openJournalModal(entry) {
  editingEntry = entry;
  document.getElementById("journalModalTitle").textContent = entry
    ? "Редактировать запись"
    : "Новая запись";
  document.getElementById("journalTitle").value = entry?.title || "";
  document.getElementById("journalDate").value =
    entry?.entryDate || new Date().toISOString().slice(0, 10);
  document.getElementById("journalMood").value = entry?.mood || "";
  document.getElementById("journalContent").value =
    entry?.content?.replace(/<[^>]+>/g, "") || "";
  document.getElementById("journalModal").classList.add("open");
}

function closeJournalModal() {
  document.getElementById("journalModal").classList.remove("open");
  editingEntry = null;
}

document
  .getElementById("saveJournalBtn")
  ?.addEventListener("click", async () => {
    const title = document.getElementById("journalTitle").value.trim();
    if (!title) {
      showToast("Введите заголовок", "error");
      return;
    }

    const body = {
      title,
      entryDate: document.getElementById("journalDate").value || null,
      mood: document.getElementById("journalMood").value || null,
      content: document.getElementById("journalContent").value.trim() || null,
    };

    const btn = document.getElementById("saveJournalBtn");
    setLoading(btn, true);

    try {
      if (editingEntry) {
        await api.put(`/api/trips/${tripId}/journal/${editingEntry.id}`, body);
      } else {
        await api.post(`/api/trips/${tripId}/journal`, body);
      }
      closeJournalModal();
      await loadJournal();
      await loadTrip();
      showToast(
        editingEntry ? "Запись обновлена" : "Запись добавлена",
        "success",
      );
    } catch (err) {
      showToast("Ошибка: " + err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

async function deleteEntry(id) {
  if (!confirm("Удалить запись?")) return;
  try {
    await api.delete(`/api/trips/${tripId}/journal/${id}`);
    await loadJournal();
    await loadTrip();
    showToast("Запись удалена", "success");
  } catch (err) {
    showToast("Ошибка: " + err.message, "error");
  }
}

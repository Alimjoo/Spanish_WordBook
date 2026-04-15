const API_URL = "/api/words";

const form = document.querySelector("#word-form");
const spanishInput = document.querySelector("#spanish-word");
const meaningInput = document.querySelector("#word-meaning");
const noteInput = document.querySelector("#word-note");
const submitButton = form.querySelector("button[type='submit']");
const message = document.querySelector("#form-message");
const list = document.querySelector("#word-list");
const emptyState = document.querySelector("#empty-state");
const totalCount = document.querySelector("#total-count");
const addWordToggle = document.querySelector("#add-word-toggle");
const wordDialog = document.querySelector("#word-dialog");
const closeDialog = document.querySelector("#close-dialog");
const rememberedToggle = document.querySelector("#remembered-toggle");

let words = [];
let showingRemembered = false;

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "La solicitud falló.");
  }

  return data;
}

function getVisibleWords() {
  return words.filter((word) => Boolean(word.remembered) === showingRemembered);
}

function renderWords() {
  const activeWords = words.filter((word) => !word.remembered);
  const rememberedWords = words.filter((word) => word.remembered);
  const visibleWords = getVisibleWords();

  totalCount.textContent = showingRemembered ? rememberedWords.length : activeWords.length;
  rememberedToggle.textContent = showingRemembered ? "Palabras actuales" : "Palabras recordadas";
  rememberedToggle.setAttribute("aria-pressed", String(showingRemembered));
  list.innerHTML = visibleWords.map(renderWordCard).join("");

  emptyState.classList.toggle("is-visible", visibleWords.length === 0);
  emptyState.querySelector("p").textContent = showingRemembered
    ? "Todavía no hay palabras recordadas."
    : "Todavía no hay palabras guardadas.";
  emptyState.querySelector("span").textContent = showingRemembered
    ? "Marca una palabra como recordada cuando ya te salga natural."
    : "Añade la próxima palabra en español que quieras guardar.";
}

function renderWordCard(word) {
  const note = word.note
    ? `<p class="note">${escapeHtml(word.note)}</p>`
    : "";
  const actionText = word.remembered ? "Practicar" : "Recordada";
  const actionLabel = word.remembered
    ? `Mover ${word.spanish} a palabras actuales`
    : `Marcar ${word.spanish} como recordada`;
  const rememberedDate = word.rememberedAt
    ? `<time class="date" datetime="${escapeHtml(word.rememberedAt)}">Recordada el ${formatDate(word.rememberedAt)}</time>`
    : "";

  return `
    <li class="word-card ${word.remembered ? "is-remembered" : ""}" data-id="${escapeHtml(word.id)}">
      <div>
        <h3 lang="es">${escapeHtml(word.spanish)}</h3>
        <p class="meaning">${escapeHtml(word.meaning)}</p>
        ${note}
        <time class="date" datetime="${escapeHtml(word.createdAt)}">Añadida el ${formatDate(word.createdAt)}</time>
        ${rememberedDate}
      </div>
      <button
        class="remember-button"
        type="button"
        data-action="remember"
        aria-label="${escapeHtml(actionLabel)}"
      >
        ${actionText}
      </button>
    </li>
  `;
}

function openWordDialog() {
  message.textContent = "";

  if (typeof wordDialog.showModal === "function") {
    wordDialog.showModal();
  } else {
    wordDialog.setAttribute("open", "");
  }

  spanishInput.focus();
}

function closeWordDialog() {
  if (wordDialog.open && typeof wordDialog.close === "function") {
    wordDialog.close();
  } else {
    wordDialog.removeAttribute("open");
  }

  addWordToggle.focus();
}

async function loadWords() {
  message.textContent = "Cargando palabras del servidor...";

  try {
    const data = await requestJson(API_URL);
    words = Array.isArray(data.words) ? data.words : [];
    message.textContent = "";
  } catch {
    words = [];
    message.textContent = "No se pudieron cargar las palabras del servidor.";
  }

  renderWords();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const spanish = normalize(spanishInput.value);
  const meaning = normalize(meaningInput.value);
  const note = normalize(noteInput.value);

  if (!spanish || !meaning) {
    message.textContent = "Añade primero la palabra y su significado.";
    return;
  }

  submitButton.disabled = true;
  message.textContent = "Guardando en el servidor...";

  try {
    const data = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ spanish, meaning, note }),
    });

    words = [data.word, ...words];
    showingRemembered = false;
    renderWords();
    form.reset();
    message.textContent = `${spanish} se guardó en el servidor.`;
    closeWordDialog();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='remember']");

  if (!button) {
    return;
  }

  const card = button.closest(".word-card");
  const word = words.find((item) => item.id === card.dataset.id);

  if (!word) {
    return;
  }

  const nextRemembered = !word.remembered;

  button.disabled = true;
  button.textContent = nextRemembered ? "..." : "...";

  try {
    const data = await requestJson(`${API_URL}/${encodeURIComponent(card.dataset.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ remembered: nextRemembered }),
    });
    words = words.map((item) => item.id === data.word.id ? data.word : item);
    renderWords();
    message.textContent = nextRemembered
      ? `${word.spanish} se marcó como recordada.`
      : `${word.spanish} volvió a palabras actuales.`;
  } catch (error) {
    button.disabled = false;
    button.textContent = word.remembered ? "Practicar" : "Recordada";
    message.textContent = error.message;
  }
});

rememberedToggle.addEventListener("click", () => {
  showingRemembered = !showingRemembered;
  renderWords();
});

addWordToggle.addEventListener("click", openWordDialog);
closeDialog.addEventListener("click", closeWordDialog);

wordDialog.addEventListener("click", (event) => {
  if (event.target === wordDialog) {
    closeWordDialog();
  }
});

loadWords();

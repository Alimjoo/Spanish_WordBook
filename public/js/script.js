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

let words = [];

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
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
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function renderWords() {
  totalCount.textContent = words.length;
  list.innerHTML = words.map(renderWordCard).join("");

  emptyState.classList.toggle("is-visible", words.length === 0);
  emptyState.querySelector("p").textContent = "No saved words yet.";
  emptyState.querySelector("span").textContent = "Add the next Spanish word you want to keep.";
}

function renderWordCard(word) {
  const note = word.note
    ? `<p class="note">${escapeHtml(word.note)}</p>`
    : "";

  return `
    <li class="word-card" data-id="${escapeHtml(word.id)}">
      <div>
        <h3 lang="es">${escapeHtml(word.spanish)}</h3>
        <p class="meaning">${escapeHtml(word.meaning)}</p>
        ${note}
        <time class="date" datetime="${escapeHtml(word.createdAt)}">Added ${formatDate(word.createdAt)}</time>
      </div>
      <button
        class="remember-button"
        type="button"
        data-action="remember"
        aria-label="Remove ${escapeHtml(word.spanish)} from WordBook"
      >
        Remembered
      </button>
    </li>
  `;
}

async function loadWords() {
  message.textContent = "Loading words from the server...";

  try {
    const data = await requestJson(API_URL);
    words = Array.isArray(data.words) ? data.words : [];
    message.textContent = "";
  } catch {
    words = [];
    message.textContent = "Could not load words from the server.";
  }

  renderWords();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const spanish = normalize(spanishInput.value);
  const meaning = normalize(meaningInput.value);
  const note = normalize(noteInput.value);

  if (!spanish || !meaning) {
    message.textContent = "Add the word and its meaning first.";
    return;
  }

  submitButton.disabled = true;
  message.textContent = "Saving to the server...";

  try {
    const data = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ spanish, meaning, note }),
    });

    words = [data.word, ...words];
    renderWords();
    form.reset();
    spanishInput.focus();
    message.textContent = `${spanish} was saved on the server.`;
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

  button.disabled = true;
  button.textContent = "Removing...";

  try {
    await requestJson(`${API_URL}/${encodeURIComponent(card.dataset.id)}`, {
      method: "DELETE",
    });
    words = words.filter((item) => item.id !== card.dataset.id);
    renderWords();

    if (word) {
      message.textContent = `${word.spanish} was removed from the server.`;
    }
  } catch (error) {
    button.disabled = false;
    button.textContent = "Remembered";
    message.textContent = error.message;
  }
});

loadWords();

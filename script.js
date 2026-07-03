// ---------- Elements ----------
const body = document.body;
const introEl = document.getElementById("intro");
const appEl = document.getElementById("app");

const codeInput = document.getElementById("code");
const codeInputWrap = document.querySelector(".code-input-wrap");
const languageSelect = document.getElementById("language");
const analyzeBtn = document.getElementById("analyze-btn");
const errorMsg = document.getElementById("error-msg");
const resultsPanel = document.getElementById("results");
const staticIssuesEl = document.getElementById("static-issues");
const reviewOutputEl = document.getElementById("review-output");

// ---------- Decorative floating code background (purely atmospheric) ----------
const CODE_TOKENS = [
  "const x =", "function()", "=> {}", "import React", "if (err)",
  "return null", "try { }", "catch (e)", "async function", "await fetch()",
  "class Agent:", "def analyze():", "SELECT * FROM", "git commit -m",
  "npm install", "console.log()", "// TODO", "0x1F3A7", "while (true)",
];

function initCodeBackground() {
  const container = document.getElementById("code-bg");
  if (!container) return;
  for (let i = 0; i < 42; i++) {
    const span = document.createElement("span");
    span.textContent = CODE_TOKENS[Math.floor(Math.random() * CODE_TOKENS.length)];
    span.style.left = `${Math.random() * 100}%`;
    span.style.fontSize = `${0.85 + Math.random() * 1.35}rem`;
    const duration = 11 + Math.random() * 14;
    span.style.animationDuration = `${duration}s`;
    span.style.animationDelay = `-${Math.random() * duration}s`;
    container.appendChild(span);
  }
}
initCodeBackground();

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const newReviewBtn = document.getElementById("new-review-btn");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

const accountArea = document.getElementById("account-area");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const authModal = document.getElementById("auth-modal");

let currentUser = null;

// ---------- Intro animation: terminal boot sequence + crossfade ----------
const introSub = document.getElementById("intro-sub");
const bootLines = ["booting analysis engine...", "connecting to groq...", "ready."];

async function typeLine(el, text, speed = 28) {
  el.textContent = "";
  for (const ch of text) {
    el.textContent += ch;
    await new Promise(r => setTimeout(r, speed));
  }
}

async function runBootSequence() {
  const cursor = document.createElement("span");
  cursor.className = "typed-cursor";
  for (const line of bootLines) {
    await typeLine(introSub, line);
    await new Promise(r => setTimeout(r, 220));
  }
  introSub.appendChild(cursor);
}

window.addEventListener("load", () => {
  runBootSequence();
  setTimeout(() => {
    introEl.classList.add("intro-hide");
    appEl.classList.add("app-visible");
  }, 2100);

  introEl.addEventListener("transitionend", () => {
    introEl.style.display = "none";
    body.classList.remove("intro-active");
  }, { once: true });
});

// ---------- Theme (persisted locally, per browser) ----------
function applyTheme(theme, mode) {
  body.setAttribute("data-theme", theme);
  body.setAttribute("data-mode", mode);
  localStorage.setItem("codesense-theme", theme);
  localStorage.setItem("codesense-mode", mode);

  document.querySelectorAll(".color-swatch").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.theme === theme));
  document.querySelectorAll(".theme-swatch").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === mode));
}

function loadTheme() {
  const theme = localStorage.getItem("codesense-theme") || "teal";
  const mode = localStorage.getItem("codesense-mode") || "dark";
  applyTheme(theme, mode);
}
loadTheme();

document.getElementById("accent-options").addEventListener("click", (e) => {
  const btn = e.target.closest(".color-swatch");
  if (btn) applyTheme(btn.dataset.theme, body.getAttribute("data-mode"));
});
document.getElementById("mode-options").addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-swatch");
  if (btn) applyTheme(body.getAttribute("data-theme"), btn.dataset.mode);
});

// ---------- Modal helpers ----------
function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }

document.querySelectorAll("[data-close]").forEach(btn =>
  btn.addEventListener("click", () => closeModal(btn.dataset.close)));
document.querySelectorAll(".modal-overlay").forEach(overlay =>
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; }));

settingsBtn.addEventListener("click", () => {
  document.getElementById("settings-account-info").textContent = currentUser
    ? `Signed in as ${currentUser.username} (${currentUser.email})`
    : "You're browsing as a guest — sign in to save your review history.";
  document.getElementById("settings-logout-btn").hidden = !currentUser;
  openModal("settings-modal");
});

document.getElementById("settings-logout-btn").addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  currentUser = null;
  closeModal("settings-modal");
  renderAccountArea();
  loadHistory();
});

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

newReviewBtn.addEventListener("click", () => {
  codeInput.value = "";
  errorMsg.textContent = "";
  resultsPanel.hidden = true;
});

// ---------- Auth ----------
function renderAccountArea() {
  accountArea.innerHTML = "";
  if (currentUser) {
    const chip = document.createElement("button");
    chip.className = "account-chip";
    chip.textContent = currentUser.username;
    chip.addEventListener("click", () => settingsBtn.click());
    accountArea.appendChild(chip);
  } else {
    const btn = document.createElement("button");
    btn.textContent = "Sign In";
    btn.addEventListener("click", () => openModal("auth-modal"));
    accountArea.appendChild(btn);
  }
}

document.querySelectorAll(".modal-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    document.getElementById("login-form").hidden = !isLogin;
    document.getElementById("signup-form").hidden = isLogin;
  });
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("login-identifier").value;
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; return; }

  currentUser = data.user;
  closeModal("auth-modal");
  renderAccountArea();
  loadHistory();
});

document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("signup-username").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const errEl = document.getElementById("signup-error");
  errEl.textContent = "";

  const res = await fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; return; }

  currentUser = data.user;
  closeModal("auth-modal");
  renderAccountArea();
  loadHistory();
});

async function checkSession() {
  const res = await fetch("/me");
  const data = await res.json();
  currentUser = data.user;
  renderAccountArea();
  loadHistory();
}

// ---------- Review rendering ----------
// We control the LLM's output format (see prompts.py), so this only needs
// to handle ## headings, ```code blocks```, and - bullet lists. Each ##
// section becomes its own collapsible card.
const SECTION_META = {
  "Purpose": { cls: "section-purpose", icon: "◆" },
  "Errors & Bugs": { cls: "section-errors", icon: "⚠" },
  "Suggestions": { cls: "section-suggestions", icon: "✦" },
  "Corrected Code": { cls: "section-fix", icon: "✓" },
};

function renderReview(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let current = null;
  let body = "";
  let inCode = false;
  let inList = false;

  const flushList = () => { if (inList) { body += "</ul>"; inList = false; } };
  const flushSection = () => { if (current) { current.body = body; sections.push(current); } };

  for (const line of lines) {
    if (line.startsWith("```")) {
      body += inCode ? "</code></pre>" : "<pre><code>";
      inCode = !inCode;
      continue;
    }
    if (inCode) { body += escapeHtml(line) + "\n"; continue; }

    if (line.startsWith("## ")) {
      flushList();
      flushSection();
      const title = line.slice(3).trim();
      const meta = SECTION_META[title] || { cls: "", icon: "•" };
      current = { title, cls: meta.cls, icon: meta.icon };
      body = "";
    } else if (line.trim().startsWith("- ")) {
      if (!inList) { body += "<ul>"; inList = true; }
      body += `<li>${escapeHtml(line.trim().slice(2))}</li>`;
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      body += `<p>${escapeHtml(line)}</p>`;
    }
  }
  flushList();
  flushSection();

  return sections.map((s, i) => `
    <section class="review-card ${s.cls}" data-section="${i}">
      <button class="review-card-header" type="button" data-toggle>
        <span class="review-card-icon">${s.icon}</span>
        <span class="review-card-title">${escapeHtml(s.title)}</span>
        <span class="review-card-chevron">▾</span>
      </button>
      <div class="review-card-body"><div class="review-card-body-inner">${s.body}</div></div>
    </section>
  `).join("");
}

// Delegated click handler: toggle whichever card's header was clicked
reviewOutputEl.addEventListener("click", (e) => {
  const header = e.target.closest("[data-toggle]");
  if (!header) return;
  header.closest(".review-card").classList.toggle("collapsed");
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderStaticIssues(issues) {
  staticIssuesEl.className = issues.length ? "panel static-issues" : "panel static-issues clean";
  staticIssuesEl.innerHTML = issues.length
    ? `<strong>Static checker found ${issues.length} issue(s):</strong><ul>${issues.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
    : "<strong>Static checker: no issues found.</strong>";
}

// ---------- Analyze ----------
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(button, label) {
  let i = 0;
  button.textContent = `${SPINNER_FRAMES[0]} ${label}`;
  return setInterval(() => {
    i = (i + 1) % SPINNER_FRAMES.length;
    button.textContent = `${SPINNER_FRAMES[i]} ${label}`;
  }, 80);
}

async function analyze() {
  const code = codeInput.value.trim();
  errorMsg.textContent = "";
  if (!code) { errorMsg.textContent = "Paste some code first."; return; }

  analyzeBtn.disabled = true;
  codeInputWrap.classList.add("scanning");
  const spinnerInterval = startSpinner(analyzeBtn, "Analyzing");

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language: languageSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) { errorMsg.textContent = data.error || "Something went wrong."; return; }

    renderStaticIssues(data.static_issues || []);
    reviewOutputEl.innerHTML = renderReview(data.review);
    Array.from(reviewOutputEl.children).forEach((el, i) => {
      el.classList.add("review-fade-in");
      el.style.animationDelay = `${i * 55}ms`;
    });
    resultsPanel.hidden = false;

    if (data.saved) loadHistory();
  } catch (e) {
    errorMsg.textContent = "Could not reach the server. Is it running?";
  } finally {
    clearInterval(spinnerInterval);
    codeInputWrap.classList.remove("scanning");
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Code";
  }
}
analyzeBtn.addEventListener("click", analyze);

// ---------- History (sidebar) ----------
async function loadHistory() {
  if (!currentUser) {
    historyList.innerHTML = "";
    historyEmpty.hidden = false;
    historyEmpty.innerHTML = `<span class="guest-note-icon">⚠</span> Your responses aren't being saved. <button id="sidebar-login-btn" class="inline-link">Log in</button> to keep and revisit your review history.`;
    document.getElementById("sidebar-login-btn").addEventListener("click", () => openModal("auth-modal"));
    return;
  }
  try {
    const res = await fetch("/history");
    const items = await res.json();
    historyEmpty.hidden = items.length > 0;
    if (items.length === 0) {
      historyEmpty.innerHTML = "No reviews yet — analyze some code to get started.";
    }
    historyList.innerHTML = items.map((item, i) => `
      <li data-id="${item.id}" style="animation-delay:${i * 0.03}s">
        <span class="hist-lang">${escapeHtml(item.language)}</span>${escapeHtml(item.code.slice(0, 32).replace(/\n/g, " "))}${item.code.length > 32 ? "…" : ""}
      </li>
    `).join("");

    historyList.querySelectorAll("li").forEach(li => {
      li.addEventListener("click", () => loadHistoryItem(li.dataset.id));
    });
  } catch (e) {
    // history is a nice-to-have, fail silently
  }
}

async function loadHistoryItem(id) {
  const res = await fetch(`/history/${id}`);
  if (!res.ok) return;
  const item = await res.json();
  codeInput.value = item.code;
  languageSelect.value = item.language;
  renderStaticIssues(item.static_issues ? item.static_issues.split("\n").filter(Boolean) : []);
  reviewOutputEl.innerHTML = renderReview(item.review);
  resultsPanel.hidden = false;
}

// ---------- Init ----------
renderAccountArea();
checkSession();

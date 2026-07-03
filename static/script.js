var body = document.body;
var introEl = document.getElementById("intro");
var appEl = document.getElementById("app");
var modeSelectEl = document.getElementById("mode-select");
var hexRainEl = document.getElementById("hex-rain");

var codeInput = document.getElementById("code");
var codeInputWrap = document.querySelector("#debugger-view .code-input-wrap");
var languageSelect = document.getElementById("language");
var analyzeBtn = document.getElementById("analyze-btn");
var errorMsg = document.getElementById("error-msg");
var resultsPanel = document.getElementById("results");
var staticIssuesEl = document.getElementById("static-issues");
var reviewOutputEl = document.getElementById("review-output");

var debuggerView = document.getElementById("debugger-view");
var generatorView = document.getElementById("generator-view");
var sidebarLabel = document.getElementById("sidebar-label");
var topbarTitle = document.getElementById("topbar-title");

var targetLanguageSelect = document.getElementById("target-language");
var genPromptInput = document.getElementById("gen-prompt");
var genPromptWrap = document.querySelector("#generator-view .code-input-wrap");
var generateBtn = document.getElementById("generate-btn");
var genErrorMsg = document.getElementById("gen-error-msg");
var genResultsPanel = document.getElementById("gen-results");
var genOutputEl = document.getElementById("gen-output");

var sidebar = document.getElementById("sidebar");
var sidebarToggle = document.getElementById("sidebar-toggle");
var newReviewBtn = document.getElementById("new-review-btn");
var historyList = document.getElementById("history-list");
var historyEmpty = document.getElementById("history-empty");

var accountArea = document.getElementById("account-area");
var settingsBtn = document.getElementById("settings-btn");
var exitModeBtn = document.getElementById("exit-mode-btn");

var currentUser = null;
var currentSection = null;

// ===== Floating code background =====
var CODE_TOKENS = [
  "const x =", "function()", "=> {}", "import React", "if (err)",
  "return null", "try { }", "catch (e)", "async function", "await fetch()",
  "class Agent:", "def analyze():", "SELECT * FROM", "git commit -m",
  "npm install", "console.log()", "// TODO", "0x1F3A7", "while (true)"
];
(function initCodeBackground() {
  var c = document.getElementById("code-bg");
  if (!c) return;
  for (var i = 0; i < 42; i++) {
    var s = document.createElement("span");
    s.textContent = CODE_TOKENS[Math.floor(Math.random() * CODE_TOKENS.length)];
    s.style.left = Math.random() * 100 + "%";
    s.style.fontSize = (0.85 + Math.random() * 1.35) + "rem";
    var d = 11 + Math.random() * 14;
    s.style.animationDuration = d + "s";
    s.style.animationDelay = "-" + (Math.random() * d) + "s";
    c.appendChild(s);
  }
})();

// ===== Hex rain =====
var HEX_CHARS = "0123456789ABCDEF";
var HEX_TOKENS = [];
for (var h = 0; h < 16; h++) HEX_TOKENS.push("0x" + HEX_CHARS[h] + HEX_CHARS[Math.floor(Math.random() * 16)]);
HEX_TOKENS.push(">>0x1F", "0xFF", "0xDEAD", "0xBEEF", "0xCAFE", ">>SHIFT", "&&AND", "||OR", "^XOR", "~NOT");
(function initHexRain() {
  if (!hexRainEl) return;
  for (var i = 0; i < 35; i++) {
    var s = document.createElement("span");
    s.textContent = HEX_TOKENS[Math.floor(Math.random() * HEX_TOKENS.length)];
    s.style.left = Math.random() * 100 + "%";
    s.style.fontSize = (0.65 + Math.random() * 0.9) + "rem";
    var d = 6 + Math.random() * 10;
    s.style.animationDuration = d + "s";
    s.style.animationDelay = "-" + (Math.random() * d) + "s";
    hexRainEl.appendChild(s);
  }
})();

// ===== Intro =====
var introSub = document.getElementById("intro-sub");
var bootLines = ["booting...", "ready.", "let's code."];

function typeLine(el, text, speed) {
  speed = speed || 55;
  el.textContent = "";
  return new Promise(function(resolve) {
    var idx = 0;
    function next() {
      if (idx < text.length) { el.textContent += text[idx]; idx++; setTimeout(next, speed); }
      else { resolve(); }
    }
    next();
  });
}

function runBootSequence() {
  var chain = Promise.resolve();
  for (var i = 0; i < bootLines.length; i++) {
    (function(line) {
      chain = chain.then(function() { return typeLine(introSub, line); })
        .then(function() { return new Promise(function(r) { setTimeout(r, 250); }); });
    })(bootLines[i]);
  }
  chain.then(function() {
    var cursor = document.createElement("span");
    cursor.className = "typed-cursor";
    introSub.appendChild(cursor);
  });
}

window.addEventListener("load", function() {
  runBootSequence();
  setTimeout(function() {
    introEl.classList.add("intro-hide");
    modeSelectEl.hidden = false;
    requestAnimationFrame(function() { modeSelectEl.classList.add("visible"); });
  }, 1900);
  introEl.addEventListener("transitionend", function() {
    introEl.style.display = "none";
    body.classList.remove("intro-active");
  }, { once: true });
});

// ===== Enter mode =====
function enterMode(section) {
  currentSection = section;
  sidebarLabel.textContent = section === "debug" ? "Recent Reviews" : "Recent Generations";
  topbarTitle.innerHTML = section === "debug"
    ? 'CodeSense/<span class="header-cursor"></span><span class="mode-label">Debugger</span><span class="mode-emoji" style="color:var(--errors-color)">&#128027;</span>'
    : 'CodeSense/<span class="header-cursor"></span><span class="mode-label">Generator</span><span class="mode-emoji" style="color:var(--fix-color)">&#10024;</span>';
  debuggerView.hidden = section !== "debug";
  generatorView.hidden = section !== "generate";
  var v = section === "debug" ? debuggerView : generatorView;
  v.style.animation = "none"; v.offsetHeight; v.style.animation = "";
  appEl.classList.add("app-visible");
  loadHistory();
}

document.querySelectorAll(".mode-card").forEach(function(card) {
  card.addEventListener("click", function() {
    document.querySelectorAll(".mode-card").forEach(function(c) { c.classList.remove("selected"); });
    card.classList.add("selected");
    modeSelectEl.classList.add("leaving");
    setTimeout(function() {
      modeSelectEl.classList.remove("visible", "leaving");
      modeSelectEl.hidden = true;
      enterMode(card.dataset.choose);
    }, 260);
  });
});

// ===== Exit =====
exitModeBtn.addEventListener("click", function() {
  appEl.classList.remove("app-visible");
  setTimeout(function() {
    codeInput.value = ""; genPromptInput.value = "";
    errorMsg.textContent = ""; genErrorMsg.textContent = "";
    resultsPanel.hidden = true; genResultsPanel.hidden = true;
    reviewOutputEl.innerHTML = ""; genOutputEl.innerHTML = ""; staticIssuesEl.innerHTML = "";
    debuggerView.hidden = true; generatorView.hidden = true; currentSection = null;
    modeSelectEl.hidden = false;
    document.querySelectorAll(".mode-card").forEach(function(c) {
      c.classList.remove("selected"); c.style.animation = "none"; c.offsetHeight; c.style.animation = "";
    });
    requestAnimationFrame(function() { modeSelectEl.classList.add("visible"); });
  }, 220);
});

// ===== Sidebar =====
sidebarToggle.addEventListener("click", function() { sidebar.classList.toggle("collapsed"); });
newReviewBtn.addEventListener("click", function() {
  if (currentSection === "debug") { codeInput.value = ""; errorMsg.textContent = ""; resultsPanel.hidden = true; reviewOutputEl.innerHTML = ""; staticIssuesEl.innerHTML = ""; }
  else if (currentSection === "generate") { genPromptInput.value = ""; genErrorMsg.textContent = ""; genResultsPanel.hidden = true; genOutputEl.innerHTML = ""; }
});

// ===== Theme =====
function applyTheme(theme, mode) {
  body.setAttribute("data-theme", theme); body.setAttribute("data-mode", mode);
  localStorage.setItem("codesense-theme", theme); localStorage.setItem("codesense-mode", mode);
  document.querySelectorAll(".color-swatch").forEach(function(b) { b.classList.toggle("active", b.dataset.theme === theme); });
  document.querySelectorAll(".theme-swatch").forEach(function(b) { b.classList.toggle("active", b.dataset.mode === mode); });
}
(function() { applyTheme(localStorage.getItem("codesense-theme") || "teal", localStorage.getItem("codesense-mode") || "dark"); })();
document.getElementById("accent-options").addEventListener("click", function(e) { var b = e.target.closest(".color-swatch"); if (b) applyTheme(b.dataset.theme, body.getAttribute("data-mode")); });
document.getElementById("mode-options").addEventListener("click", function(e) { var b = e.target.closest(".theme-swatch"); if (b) applyTheme(body.getAttribute("data-theme"), b.dataset.mode); });

// ===== Modals =====
function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }
document.querySelectorAll("[data-close]").forEach(function(b) { b.addEventListener("click", function() { closeModal(b.dataset.close); }); });
document.querySelectorAll(".modal-overlay").forEach(function(o) { o.addEventListener("click", function(e) { if (e.target === o) o.hidden = true; }); });
settingsBtn.addEventListener("click", function() {
  document.getElementById("settings-account-info").textContent = currentUser ? "Signed in as " + currentUser.username + " (" + currentUser.email + ")" : "You\u2019re browsing as a guest \u2014 sign in to save your history.";
  document.getElementById("settings-logout-btn").hidden = !currentUser;
  openModal("settings-modal");
});
document.getElementById("settings-logout-btn").addEventListener("click", async function() { await fetch("/logout", { method: "POST" }); currentUser = null; closeModal("settings-modal"); renderAccountArea(); loadHistory(); });

// ===== Auth =====
function renderAccountArea() {
  accountArea.innerHTML = "";
  if (currentUser) { var c = document.createElement("button"); c.className = "account-chip"; c.textContent = currentUser.username; c.addEventListener("click", function() { settingsBtn.click(); }); accountArea.appendChild(c); }
  else { var b = document.createElement("button"); b.textContent = "Sign In"; b.addEventListener("click", function() { openModal("auth-modal"); }); accountArea.appendChild(b); }
}
document.querySelectorAll(".modal-tab").forEach(function(t) {
  t.addEventListener("click", function() {
    document.querySelectorAll(".modal-tab").forEach(function(x) { x.classList.remove("active"); }); t.classList.add("active");
    var isLogin = t.dataset.tab === "login"; document.getElementById("login-form").hidden = !isLogin; document.getElementById("signup-form").hidden = isLogin;
  });
});
document.getElementById("login-form").addEventListener("submit", async function(e) {
  e.preventDefault(); var err = document.getElementById("login-error"); err.textContent = "";
  var r = await fetch("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: document.getElementById("login-identifier").value, password: document.getElementById("login-password").value }) });
  var d = await r.json(); if (!r.ok) { err.textContent = d.error; return; } currentUser = d.user; closeModal("auth-modal"); renderAccountArea(); loadHistory();
});
document.getElementById("signup-form").addEventListener("submit", async function(e) {
  e.preventDefault(); var err = document.getElementById("signup-error"); err.textContent = "";
  var r = await fetch("/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: document.getElementById("signup-username").value, email: document.getElementById("signup-email").value, password: document.getElementById("signup-password").value }) });
  var d = await r.json(); if (!r.ok) { err.textContent = d.error; return; } currentUser = d.user; closeModal("auth-modal"); renderAccountArea(); loadHistory();
});
async function checkSession() { try { var r = await fetch("/me"); var d = await r.json(); currentUser = d.user || null; } catch (e) { currentUser = null; } renderAccountArea(); }

// ===== Review rendering =====
var SECTION_META = { "Purpose": { cls: "section-purpose", icon: "\u25C6" }, "Errors & Bugs": { cls: "section-errors", icon: "\u26A0" }, "Suggestions": { cls: "section-suggestions", icon: "\u2726" }, "Corrected Code": { cls: "section-fix", icon: "\u2713" }, "Explanation": { cls: "section-purpose", icon: "\u25C6" }, "Code": { cls: "section-fix", icon: "\u25B9" }, "How to Run": { cls: "section-suggestions", icon: "\u25B6" } };
function escapeHtml(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function renderReview(md) {
  var lines = md.split("\n"), sections = [], cur = null, html = "", inC = false, inL = false;
  function fL() { if (inL) { html += "</ul>"; inL = false; } }
  function fS() { if (cur) { cur.body = html; sections.push(cur); } }
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (l.startsWith("```")) { html += inC ? "</code></pre>" : "<pre><code>"; inC = !inC; continue; }
    if (inC) { html += escapeHtml(l) + "\n"; continue; }
    if (l.startsWith("## ")) { fL(); fS(); var t = l.slice(3).trim(), m = SECTION_META[t] || { cls: "", icon: "\u2022" }; cur = { title: t, cls: m.cls, icon: m.icon }; html = ""; }
    else if (l.trim().startsWith("- ")) { if (!inL) { html += "<ul>"; inL = true; } html += "<li>" + escapeHtml(l.trim().slice(2)) + "</li>"; }
    else if (l.trim() === "") { fL(); }
    else { fL(); html += "<p>" + escapeHtml(l) + "</p>"; }
  }
  fL(); fS();
  return sections.map(function(s, idx) {
    return '<section class="review-card ' + s.cls + '" data-section="' + idx + '"><button class="review-card-header" type="button" data-toggle><span class="review-card-icon">' + s.icon + '</span><span class="review-card-title">' + escapeHtml(s.title) + '</span><span class="review-card-chevron">\u25BE</span></button><div class="review-card-body"><div class="review-card-body-inner">' + s.body + '</div></div></section>';
  }).join("");
}

function attachCardToggle(c) { c.addEventListener("click", function(e) { var h = e.target.closest("[data-toggle]"); if (h) h.closest(".review-card").classList.toggle("collapsed"); }); }
attachCardToggle(reviewOutputEl); attachCardToggle(genOutputEl);

function renderStaticIssues(issues) {
  staticIssuesEl.className = issues.length ? "panel static-issues" : "panel static-issues clean";
  staticIssuesEl.innerHTML = issues.length ? "<strong>Static checker found " + issues.length + " issue(s):</strong><ul>" + issues.map(function(i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("") + "</ul>" : "<strong>Static checker: no issues found.</strong>";
}

// ===== Spinner =====
var SF = ["\u280B","\u2819","\u2839","\u2838","\u283C","\u2834","\u2826","\u2827","\u2807","\u280F"];
function startSpinner(btn, label) { var i = 0; btn.textContent = SF[0] + " " + label; return setInterval(function() { i = (i + 1) % SF.length; btn.textContent = SF[i] + " " + label; }, 80); }

// ===== Analyze =====
async function analyze() {
  var code = codeInput.value.trim(); errorMsg.textContent = "";
  if (!code) { errorMsg.textContent = "Paste some code first."; return; }
  analyzeBtn.disabled = true; codeInputWrap.classList.add("scanning"); var si = startSpinner(analyzeBtn, "Analyzing");
  try {
    var r = await fetch("/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, language: languageSelect.value }) });
    var d = await r.json(); if (!r.ok) { errorMsg.textContent = d.error || "Something went wrong."; return; }
    renderStaticIssues(d.static_issues || []); reviewOutputEl.innerHTML = renderReview(d.review);
    Array.from(reviewOutputEl.children).forEach(function(el, i) { el.classList.add("review-fade-in"); el.style.animationDelay = (i * 55) + "ms"; });
    resultsPanel.hidden = false; if (d.saved) loadHistory();
  } catch (e) { errorMsg.textContent = "Could not reach the server. Is it running?"; }
  finally { clearInterval(si); codeInputWrap.classList.remove("scanning"); analyzeBtn.disabled = false; analyzeBtn.textContent = "Analyze Code"; }
}
analyzeBtn.addEventListener("click", analyze);

// ===== Generate =====
async function generate() {
  var desc = genPromptInput.value.trim(); genErrorMsg.textContent = "";
  if (!desc) { genErrorMsg.textContent = "Describe the program you want first."; return; }
  generateBtn.disabled = true; genPromptWrap.classList.add("scanning"); var si = startSpinner(generateBtn, "Generating");
  try {
    var r = await fetch("/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: desc, target_language: targetLanguageSelect.value }) });
    var d = await r.json(); if (!r.ok) { genErrorMsg.textContent = d.error || "Something went wrong."; return; }
    genOutputEl.innerHTML = renderReview(d.result);
    Array.from(genOutputEl.children).forEach(function(el, i) { el.classList.add("review-fade-in"); el.style.animationDelay = (i * 55) + "ms"; });
    genResultsPanel.hidden = false; if (d.saved) loadHistory();
  } catch (e) { genErrorMsg.textContent = "Could not reach the server. Is it running?"; }
  finally { clearInterval(si); genPromptWrap.classList.remove("scanning"); generateBtn.disabled = false; generateBtn.textContent = "Generate Code"; }
}
generateBtn.addEventListener("click", generate);

// ===== History =====
async function loadHistory() {
  if (!currentUser) {
    historyList.innerHTML = ""; historyEmpty.hidden = false;
    historyEmpty.innerHTML = '<span class="guest-note-icon">\u26A0</span> Responses aren\'t saved. <button id="sidebar-login-btn" class="inline-link">Log in</button> to keep history.';
    var lb = document.getElementById("sidebar-login-btn"); if (lb) lb.addEventListener("click", function() { openModal("auth-modal"); });
    return;
  }
  try {
    var r = await fetch("/history"); var all = await r.json();
    var items = all.filter(function(it) { return it.mode === currentSection; });
    historyEmpty.hidden = items.length > 0; historyList.innerHTML = "";
    if (items.length === 0) { historyEmpty.innerHTML = currentSection === "debug" ? "No reviews yet \u2014 analyze some code to get started." : "No generations yet \u2014 describe a program to get started."; }
    else {
      historyList.innerHTML = items.map(function(item, i) { var p = item.code.slice(0, 32).replace(/\n/g, " "); if (item.code.length > 32) p += "\u2026"; return '<li data-id="' + item.id + '" style="animation-delay:' + (i * 0.03) + 's"><span class="hist-lang">' + escapeHtml(item.language) + '</span>' + escapeHtml(p) + '</li>'; }).join("");
      historyList.querySelectorAll("li").forEach(function(li) { li.addEventListener("click", function() { loadHistoryItem(li.dataset.id); }); });
    }
  } catch (e) {}
}

async function loadHistoryItem(id) {
  try {
    var r = await fetch("/history/" + id); if (!r.ok) return; var item = await r.json();
    if (item.mode === "generate") { if (currentSection !== "generate") return; targetLanguageSelect.value = item.language; genPromptInput.value = item.code; genOutputEl.innerHTML = renderReview(item.review); genResultsPanel.hidden = false; }
    else { if (currentSection !== "debug") return; codeInput.value = item.code; languageSelect.value = item.language; renderStaticIssues(item.static_issues ? item.static_issues.split("\n").filter(Boolean) : []); reviewOutputEl.innerHTML = renderReview(item.review); resultsPanel.hidden = false; }
  } catch (e) {}
}

renderAccountArea();
checkSession();
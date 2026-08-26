"use strict";

let data;
let favorites = JSON.parse(localStorage.getItem("gemini-notebook-reference-favorites") || "[]");
let favoritesOnly = false;
const views = ["home", "guide", "prompts", "gems", "articles", "glossary"];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]);
const pad = (value) => String(value).padStart(2, "0");

fetch("content.json").then((response) => {
  if (!response.ok) throw new Error("content.jsonを読み込めませんでした");
  return response.json();
}).then((json) => {
  data = json;
  setupNavigation();
  renderHome();
  renderGuide();
  setupLibraries();
  renderGlossary();
  openFromHash();
}).catch((error) => {
  document.querySelector("main").innerHTML = `<div class="empty page-width"><strong>データを読み込めませんでした</strong><p>${esc(error.message)}</p><p>GitHub PagesなどのWebサーバー上で開いてください。</p></div>`;
});

function setupNavigation() {
  document.querySelectorAll("[data-view-link]").forEach((link) => link.addEventListener("click", () => setView(link.dataset.viewLink)));
  document.getElementById("menuButton").addEventListener("click", () => {
    const nav = document.getElementById("mainNav");
    const open = nav.classList.toggle("open");
    document.getElementById("menuButton").setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("hashchange", openFromHash);
}

function openFromHash() {
  const requested = location.hash.slice(1).split("/")[0];
  setView(views.includes(requested) ? requested : "home", false);
}

function setView(name, updateHash = true) {
  views.forEach((view) => document.getElementById(`view-${view}`).classList.toggle("active", view === name));
  document.querySelectorAll("[data-view-link]").forEach((link) => link.classList.toggle("active", link.dataset.viewLink === name));
  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuButton").setAttribute("aria-expanded", "false");
  if (updateHash && location.hash !== `#${name}`) history.pushState(null, "", `#${name}`);
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderHome() {
  document.getElementById("homeModules").innerHTML = data.modules.slice(0, 6).map((module) => `<article class="module-preview"><span>${pad(module.number)}</span><small>${esc(module.part)} · ${esc(module.pages)}</small><h3>${esc(module.title)}</h3><p>${esc(module.summary)}</p></article>`).join("");
}

function renderGuide() {
  document.getElementById("guideToc").innerHTML = `<p>CONTENTS</p>${data.modules.map((module) => `<a href="#guide/${esc(module.id)}" data-module-link="${esc(module.id)}"><span>${pad(module.number)}</span>${esc(module.title)}</a>`).join("")}`;
  document.getElementById("guideModules").innerHTML = data.modules.map((module) => `<article class="guide-module" id="${esc(module.id)}"><header><div class="module-meta"><span>${pad(module.number)}</span><small>${esc(module.part)}</small><small>${esc(module.pages)}</small></div><h2>${esc(module.title)}</h2><p class="module-subtitle">${esc(module.subtitle)}</p><p class="module-lead">${esc(module.summary)}</p></header>${module.sections.map(renderSection).join("")}${renderRelated(module)}</article>`).join("");
  document.querySelectorAll("[data-module-link]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    setView("guide", false);
    document.getElementById(link.dataset.moduleLink).scrollIntoView({behavior:"smooth"});
  }));
  document.querySelectorAll("[data-prompt-search]").forEach((button) => button.addEventListener("click", () => {
    setView("prompts");
    document.getElementById("promptSearch").value = button.dataset.promptSearch;
    renderPrompts();
  }));
}

function renderSection(section) {
  const paragraphs = (section.paragraphs || []).map((item) => `<p>${esc(item)}</p>`).join("");
  const bullets = section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
  const steps = section.steps?.length ? `<ol class="steps">${section.steps.map((item, index) => `<li><b>${index + 1}</b><p>${esc(item)}</p></li>`).join("")}</ol>` : "";
  const studio = section.studioTools?.length ? `<div class="studio-grid">${section.studioTools.map((item) => `<article><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p></article>`).join("")}</div>` : "";
  return `<section class="guide-section"><h3>${esc(section.heading)}</h3>${paragraphs}${bullets}${steps}${studio}</section>`;
}

function renderRelated(module) {
  if (!module.relatedPromptIds.length) return "";
  return `<div class="related"><strong>対応プロンプト</strong><div>${module.relatedPromptIds.map((id) => { const item = data.prompts.find((prompt) => prompt.id === id); return item ? `<button data-prompt-search="${esc(item.title)}" type="button">${pad(id)} ${esc(item.title)}</button>` : ""; }).join("")}</div></div>`;
}

function setupLibraries() {
  fillSelect("promptChapter", unique(data.prompts.map((item) => item.chapter)), (value) => `第${value}章`);
  fillSelect("promptTool", unique(data.prompts.map((item) => item.tool)));
  fillSelect("articleChapter", unique(data.articles.map((item) => item.chapter)));
  fillSelect("articleCategory", unique(data.articles.map((item) => item.category)));
  ["promptSearch","promptChapter","promptTool"].forEach((id) => document.getElementById(id).addEventListener(id.includes("Search") ? "input" : "change", renderPrompts));
  document.getElementById("favoriteOnly").addEventListener("click", () => { favoritesOnly = !favoritesOnly; document.getElementById("favoriteOnly").classList.toggle("active", favoritesOnly); renderPrompts(); });
  document.getElementById("gemSearch").addEventListener("input", renderGems);
  ["articleSearch","articleChapter","articleCategory"].forEach((id) => document.getElementById(id).addEventListener(id.includes("Search") ? "input" : "change", renderArticles));
  renderPrompts(); renderGems(); renderArticles();
}

function unique(values) { return [...new Set(values)]; }
function fillSelect(id, values, label = (value) => value) { const select = document.getElementById(id); values.forEach((value) => select.insertAdjacentHTML("beforeend", `<option value="${esc(value)}">${esc(label(value))}</option>`)); }
function matches(query, values) { const needle = query.trim().toLowerCase(); return !needle || values.join(" ").toLowerCase().includes(needle); }

function renderPrompts() {
  const query = document.getElementById("promptSearch").value;
  const chapter = document.getElementById("promptChapter").value;
  const tool = document.getElementById("promptTool").value;
  const items = data.prompts.filter((item) => matches(query,[item.title,item.prompt,item.point,item.action,item.tool]) && (chapter === "all" || String(item.chapter) === chapter) && (tool === "all" || item.tool === tool) && (!favoritesOnly || favorites.includes(item.id)));
  document.getElementById("promptCount").innerHTML = `<strong>${items.length}</strong>件を表示`;
  document.getElementById("promptList").innerHTML = items.length ? items.map((item) => `<article class="prompt-card"><header class="prompt-head"><span>${pad(item.id)}</span><div><p>第${item.chapter}章 · p.${item.page} · ${esc(item.tool)}</p><h2>${esc(item.title)}</h2></div><button class="star ${favorites.includes(item.id) ? "active" : ""}" data-favorite="${item.id}" type="button" aria-label="保存">${favorites.includes(item.id) ? "★" : "☆"}</button></header><p class="action-note">使用箇所：${esc(item.action)}</p><pre>${esc(item.prompt)}</pre><div class="prompt-foot"><p><strong>使い方のポイント</strong>${esc(item.point)}</p><button class="copy" data-copy="${item.id}" type="button">プロンプトをコピー</button></div></article>`).join("") : `<div class="empty">該当するプロンプトがありません</div>`;
  document.querySelectorAll("[data-favorite]").forEach((button) => button.addEventListener("click", () => toggleFavorite(Number(button.dataset.favorite))));
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyPrompt(Number(button.dataset.copy))));
}

function toggleFavorite(id) { favorites = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites,id]; localStorage.setItem("gemini-notebook-reference-favorites",JSON.stringify(favorites)); renderPrompts(); }
async function copyPrompt(id) { const item = data.prompts.find((prompt) => prompt.id === id); await navigator.clipboard.writeText(item.prompt); showToast("プロンプトをコピーしました"); }
function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"),1800); }

function renderGems() {
  const query = document.getElementById("gemSearch").value;
  const items = data.gems.filter((item) => matches(query,[item.title,item.description,item.usage.join(" ")]));
  document.getElementById("gemCount").innerHTML = `<strong>${items.length}</strong>件を表示`;
  document.getElementById("gemList").innerHTML = items.map((item) => `<article class="gem-card"><header><span>${pad(item.id)}</span><h2>${esc(item.title)}</h2></header><p>${esc(item.description)}</p><ol>${item.usage.map((step) => `<li>${esc(step)}</li>`).join("")}</ol><div class="external"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">GEMを開く ↗</a>${item.explainer ? `<a class="subtle" href="${esc(item.explainer)}" target="_blank" rel="noreferrer">解説を見る ↗</a>` : ""}</div></article>`).join("");
}

function renderArticles() {
  const query = document.getElementById("articleSearch").value;
  const chapter = document.getElementById("articleChapter").value;
  const category = document.getElementById("articleCategory").value;
  const items = data.articles.filter((item) => matches(query,[item.title,item.chapter,item.category]) && (chapter === "all" || item.chapter === chapter) && (category === "all" || item.category === category));
  document.getElementById("articleCount").innerHTML = `<strong>${items.length}</strong>件を表示`;
  document.getElementById("articleList").innerHTML = items.map((item) => `<a href="${esc(item.url)}" target="_blank" rel="noreferrer"><span>${pad(item.id)}</span><div><p>${esc(item.chapter)} / ${esc(item.category)}</p><h2>${esc(item.title)}</h2></div><b>元記事を開く ↗</b></a>`).join("");
}

function renderGlossary() { document.getElementById("glossaryList").innerHTML = data.glossary.map((item,index) => `<article><span>${pad(index+1)}</span><h2>${esc(item.term)}</h2><p>${esc(item.definition)}</p></article>`).join(""); }

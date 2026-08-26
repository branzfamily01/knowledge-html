const CONFIG = {
  knowledgeRegistry: 'https://branzfamily01.github.io/knowledge-html/registry.json',
  appsRegistry: 'https://branzfamily01.github.io/knowledge-html/apps-registry.json',
  favoritesKey: 'myHub.favorites.v1'
};

const state = {
  items: [],
  visibleItems: [],
  filter: 'all',
  query: '',
  favorites: new Set(JSON.parse(localStorage.getItem(CONFIG.favoritesKey) || '[]')),
  loaded: { knowledge: false, apps: false }
};

const els = {
  grid: document.querySelector('#cardGrid'),
  template: document.querySelector('#cardTemplate'),
  search: document.querySelector('#searchInput'),
  tabs: document.querySelector('#filterTabs'),
  resultHeading: document.querySelector('#resultHeading'),
  resultCount: document.querySelector('#resultCount'),
  empty: document.querySelector('#emptyState'),
  syncStatus: document.querySelector('#syncStatus'),
  statAll: document.querySelector('#statAll'),
  statKnowledge: document.querySelector('#statKnowledge'),
  statApps: document.querySelector('#statApps'),
  statFavorites: document.querySelector('#statFavorites'),
  copyList: document.querySelector('#copyListButton'),
  reload: document.querySelector('#reloadButton'),
  toast: document.querySelector('#toast')
};

function cacheBust(url) {
  const u = new URL(url);
  u.searchParams.set('_', Date.now());
  return u.toString();
}

async function fetchJson(url) {
  const res = await fetch(cacheBust(url), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function normalizeKnowledge(item) {
  return {
    id: `knowledge:${item.slug}`,
    title: item.title || item.slug,
    slug: item.slug,
    kind: 'knowledge',
    type: 'Knowledge',
    category: item.category || 'Knowledge',
    tags: Array.isArray(item.tags) ? item.tags : [],
    summary: item.summary || '',
    visibility: item.visibility || 'public',
    status: item.status || 'active',
    color: knowledgeColor(item.category),
    publicUrl: item.publicUrl,
    repoUrl: item.githubRepo ? `https://github.com/branzfamily01/${item.githubRepo}` : '',
    updatedAt: item.updatedAt || item.createdAt || '',
    raw: item
  };
}

function normalizeApp(item) {
  return {
    id: `app:${item.slug || item.githubRepo}`,
    title: item.title || item.slug || item.githubRepo,
    slug: item.slug || item.githubRepo,
    kind: 'app',
    type: 'Web App',
    category: item.category || 'Web Apps',
    tags: Array.isArray(item.tags) ? item.tags : [],
    summary: item.summary || '',
    visibility: item.visibility || 'public',
    status: item.status || 'active',
    color: item.color || appColor(item.category),
    publicUrl: item.publicUrl,
    repoUrl: item.repoUrl || (item.githubRepo ? `https://github.com/branzfamily01/${item.githubRepo}` : ''),
    updatedAt: item.updatedAt || '',
    raw: item
  };
}

function knowledgeColor(category = '') {
  if (/AI|IT/.test(category)) return 'violet';
  if (/学習|英語/.test(category)) return 'green';
  if (/資料|作成/.test(category)) return 'blue';
  if (/Second Brain/.test(category)) return 'purple';
  return 'blue';
}

function appColor(category = '') {
  return ({ Learning: 'green', Tools: 'blue', Productivity: 'purple', AI: 'violet' })[category] || 'orange';
}

function iconFor(item) {
  if (item.visibility === 'private') return '🔒';
  if (item.kind === 'knowledge') {
    if (/AI|IT/.test(item.category)) return '◇';
    if (/Second Brain/.test(item.category)) return '⌘';
    if (/学習|英語/.test(item.category)) return 'A';
    return '◫';
  }
  if (item.category === 'Learning') return '✦';
  if (item.category === 'Tools') return '⌁';
  if (item.category === 'Productivity') return '✓';
  if (item.category === 'AI') return '✧';
  return '↗';
}

function visibilityLabel(item) {
  return item.visibility === 'private' ? '🔒 Private' : '🌐 Public';
}

function searchableText(item) {
  return [item.title, item.slug, item.type, item.category, item.summary, ...(item.tags || [])]
    .join(' ')
    .toLocaleLowerCase('ja');
}

function matchesFilter(item) {
  const f = state.filter;
  if (f === 'all') return true;
  if (f === 'favorites') return state.favorites.has(item.id);
  if (f === 'knowledge') return item.kind === 'knowledge';
  if (f === 'apps') return item.kind === 'app';
  if (f === 'AI') return /AI|IT/.test(item.category) || item.tags.some(t => /AI/i.test(t));
  return item.category === f;
}

function filterHeading() {
  const names = {
    all: 'すべて',
    favorites: 'お気に入り',
    knowledge: 'Knowledge',
    apps: 'Web Apps',
    Learning: 'Learning',
    Tools: 'Tools',
    AI: 'AI',
    Productivity: 'Productivity'
  };
  return names[state.filter] || state.filter;
}

function render() {
  const q = state.query.trim().toLocaleLowerCase('ja');
  state.visibleItems = state.items.filter(item => {
    if (!matchesFilter(item)) return false;
    return !q || searchableText(item).includes(q);
  });

  els.grid.replaceChildren();
  for (const item of state.visibleItems) els.grid.appendChild(renderCard(item));

  els.resultHeading.textContent = filterHeading();
  els.resultCount.textContent = `${state.visibleItems.length} items`;
  els.empty.hidden = state.visibleItems.length !== 0;
  updateStats();
}

function renderCard(item) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.color = item.color || 'blue';
  node.dataset.id = item.id;

  const badge = node.querySelector('.type-badge');
  badge.textContent = `${item.type} · ${item.category}`;

  const fav = node.querySelector('.favorite-button');
  setFavoriteButton(fav, item);
  fav.addEventListener('click', () => toggleFavorite(item, fav));

  node.querySelector('.card-icon').textContent = iconFor(item);
  node.querySelector('.card-title').textContent = item.title;
  node.querySelector('.card-summary').textContent = item.summary || '説明はこれから追加できます。';

  const tagRow = node.querySelector('.tag-row');
  for (const tag of (item.tags || []).slice(0, 4)) {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = tag;
    tagRow.appendChild(el);
  }
  if (!tagRow.children.length) tagRow.hidden = true;

  const meta = [visibilityLabel(item)];
  if (item.updatedAt) meta.push(`更新 ${item.updatedAt}`);
  node.querySelector('.card-meta').textContent = meta.join('  ·  ');

  const copy = node.querySelector('.copy-button');
  copy.addEventListener('click', () => copyText(item.publicUrl, 'URLをコピーしました'));

  const open = node.querySelector('.open-button');
  open.href = item.publicUrl || item.repoUrl || '#';
  open.setAttribute('aria-label', `${item.title}を開く`);
  if (!item.publicUrl && !item.repoUrl) {
    open.removeAttribute('href');
    open.setAttribute('aria-disabled', 'true');
  }

  return node;
}

function setFavoriteButton(button, item) {
  const on = state.favorites.has(item.id);
  button.classList.toggle('is-favorite', on);
  button.textContent = on ? '★' : '☆';
  button.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに追加');
}

function toggleFavorite(item, button) {
  if (state.favorites.has(item.id)) state.favorites.delete(item.id);
  else state.favorites.add(item.id);
  localStorage.setItem(CONFIG.favoritesKey, JSON.stringify([...state.favorites]));
  setFavoriteButton(button, item);
  if (state.filter === 'favorites') render();
  else updateStats();
}

function updateStats() {
  const knowledge = state.items.filter(x => x.kind === 'knowledge').length;
  const apps = state.items.filter(x => x.kind === 'app').length;
  els.statAll.textContent = state.items.length;
  els.statKnowledge.textContent = knowledge;
  els.statApps.textContent = apps;
  els.statFavorites.textContent = state.favorites.size;
}

function setStatus(mode, text) {
  els.syncStatus.classList.remove('is-ready', 'is-error');
  if (mode) els.syncStatus.classList.add(`is-${mode}`);
  els.syncStatus.querySelector('span:last-child').textContent = text;
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 1800);
}

async function copyText(text, success = 'コピーしました') {
  if (!text) return showToast('コピーできるURLがありません');
  try {
    await navigator.clipboard.writeText(text);
    showToast(success);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    showToast(success);
  }
}

async function loadCatalog() {
  setStatus('', 'Loading catalog…');
  const [knowledgeResult, appsResult] = await Promise.allSettled([
    fetchJson(CONFIG.knowledgeRegistry),
    fetchJson(CONFIG.appsRegistry)
  ]);

  const items = [];
  const problems = [];

  if (knowledgeResult.status === 'fulfilled') {
    state.loaded.knowledge = true;
    for (const item of knowledgeResult.value.items || []) items.push(normalizeKnowledge(item));
  } else {
    state.loaded.knowledge = false;
    problems.push('Knowledge');
    console.error('Knowledge registry:', knowledgeResult.reason);
  }

  if (appsResult.status === 'fulfilled') {
    state.loaded.apps = true;
    for (const item of appsResult.value.items || []) items.push(normalizeApp(item));
  } else {
    state.loaded.apps = false;
    problems.push('Apps');
    console.error('Apps registry:', appsResult.reason);
  }

  const seen = new Set();
  state.items = items
    .filter(item => item.publicUrl || item.repoUrl)
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title, 'ja'));

  if (!problems.length) setStatus('ready', `Synced · ${state.items.length} items`);
  else if (state.items.length) setStatus('ready', `Partial · ${problems.join(' / ')}`);
  else setStatus('error', 'Catalog unavailable');

  render();
}

els.search.addEventListener('input', e => {
  state.query = e.target.value;
  render();
});

els.tabs.addEventListener('click', e => {
  const button = e.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  for (const tab of els.tabs.querySelectorAll('.tab')) tab.classList.toggle('is-active', tab === button);
  render();
});

els.copyList.addEventListener('click', () => {
  const text = state.visibleItems.map(item => `${item.title}\n${item.publicUrl || item.repoUrl}`).join('\n\n');
  copyText(text, `${state.visibleItems.length}件のURL一覧をコピーしました`);
});

els.reload.addEventListener('click', async () => {
  await loadCatalog();
  showToast('最新情報を読み込みました');
});

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    els.search.focus();
    els.search.select();
  }
  if (e.key === 'Escape' && document.activeElement === els.search) {
    els.search.value = '';
    state.query = '';
    els.search.blur();
    render();
  }
});

loadCatalog();

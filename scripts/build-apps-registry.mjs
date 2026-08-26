import fs from 'node:fs/promises';

const OWNER = 'branzfamily01';
const API = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';

const headers = {
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'knowledge-html-app-registry'
};
if (token) headers.Authorization = `Bearer ${token}`;

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function getTextIfExists(repo, path) {
  const url = `${API}/repos/${OWNER}/${encodeURIComponent(repo)}/contents/${path}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  const data = await res.json();
  if (!data?.content || data.encoding !== 'base64') return null;
  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

function extractTitle(html, fallback) {
  const m = html?.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (m?.[1] || fallback)
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function inferCategory(name, title = '') {
  const s = `${name} ${title}`.toLowerCase();
  if (/(juken|dojo|sansu|kokugo|vocab|collocation|recall|lesson|study|jikai|umi|ocean|learning|english)/.test(s)) return 'Learning';
  if (/(pdf|photo|image|slide|epub|video|book|library|reader)/.test(s)) return 'Tools';
  if (/(second-brain|inbox|wallet|task|cleanup)/.test(s)) return 'Productivity';
  if (/(ai|gemini|claude|prompt)/.test(s)) return 'AI';
  return 'Web Apps';
}

function colorKey(category) {
  return ({
    Learning: 'green',
    Tools: 'blue',
    Productivity: 'purple',
    AI: 'violet',
    'Web Apps': 'orange'
  })[category] || 'blue';
}

async function loadJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); }
  catch { return fallback; }
}

const knowledge = await loadJson('registry.json', { items: [] });
const overridesDoc = await loadJson('apps-overrides.json', { items: {} });
const overrides = overridesDoc.items || {};

const excluded = new Set(['knowledge-html']);
for (const item of knowledge.items || []) {
  if (item.sourceRepo) excluded.add(item.sourceRepo);
}

const repos = await getJson(`${API}/users/${OWNER}/repos?per_page=100&type=owner&sort=updated`);
const items = [];

for (const repo of repos) {
  if (repo.private || repo.archived || repo.disabled || repo.size === 0) continue;
  if (!repo.has_pages) continue;
  if (excluded.has(repo.name)) continue;

  let html = null;
  try { html = await getTextIfExists(repo.name, 'index.html'); }
  catch (e) { console.warn(`index read failed: ${repo.name}: ${e.message}`); }
  if (!html) continue;

  const override = overrides[repo.name] || {};
  if (override.hidden === true) continue;

  const detectedTitle = extractTitle(html, repo.name);
  const category = override.category || inferCategory(repo.name, detectedTitle);
  const summary = override.summary || repo.description || 'GitHub Pagesで公開しているWebアプリ。';

  items.push({
    title: override.title || detectedTitle,
    slug: repo.name,
    type: 'web-app',
    category,
    tags: override.tags || [],
    summary,
    visibility: 'public',
    status: override.status || 'active',
    color: override.color || colorKey(category),
    githubRepo: repo.name,
    repoUrl: repo.html_url,
    publicUrl: override.publicUrl || `https://${OWNER}.github.io/${repo.name}/`,
    updatedAt: (repo.pushed_at || repo.updated_at || '').slice(0, 10),
    sourceType: 'github-pages-auto-index'
  });
}

items.sort((a, b) => {
  const dateCmp = String(b.updatedAt).localeCompare(String(a.updatedAt));
  return dateCmp || a.title.localeCompare(b.title, 'ja');
});

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  owner: OWNER,
  type: 'web-app-registry',
  count: items.length,
  items
};

await fs.writeFile('apps-registry.json', JSON.stringify(output, null, 2) + '\n');
console.log(`apps-registry.json: ${items.length} apps`);

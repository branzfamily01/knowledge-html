# My Hub

**Knowledge, Apps & Tools**

My Hub is a lightweight personal portal that reads two external catalogs and presents them as a searchable card library.

## Data sources

- Knowledge: `https://branzfamily01.github.io/knowledge-html/registry.json`
- Web apps: `https://branzfamily01.github.io/knowledge-html/apps-registry.json`

The Hub does **not** duplicate or move the underlying apps or Knowledge HTML files.

## Files for the standalone repository

Copy these three files to the root of `branzfamily01/my-hub`:

- `index.html`
- `style.css`
- `app.js`

Then enable GitHub Pages from `main` / root.

Expected public URL:

`https://branzfamily01.github.io/my-hub/`

## App registry automation

`knowledge-html` owns the Web app catalog:

- `apps-registry.json` — generated catalog
- `apps-overrides.json` — curated titles/categories/summaries
- `scripts/build-apps-registry.mjs` — scanner
- `.github/workflows/build-apps-registry.yml` — daily/manual regeneration

The scanner finds active public repositories with GitHub Pages and a root `index.html`, excluding repositories already represented as migrated Knowledge items.

## Future private content

Private Knowledge should not be added to the public registry. A future authenticated private registry can be added separately, with Cloudflare Access protecting both the registry and destination pages.

# HN Reader

A quieter way to read Hacker News. A small, read-only React application with a desktop split view and a focused mobile reading screen.

## Run locally

Use **Node.js 22.12 or newer**. The exact version, and the pnpm version, are pinned in `mise.toml` (the Node major is also in `.nvmrc` for nvm users).

```sh
mise install
pnpm install
pnpm run dev
```

With [mise](https://mise.jdx.dev) the scripts are also available as tasks: `mise run dev`, `build`, `test`, `test-e2e`, `typecheck`.

Vite prints the local URL. No API keys, environment variables, or backend are required.

## What it does

- Top, New, Best, Ask, and Show feeds, with 30 stories per batch and explicit refresh.
- Full-text search over the Hacker News archive, 30 results per page, shareable as `/?q=…`.
- Discussions beside the feed on desktop; a separate discussion screen below 1,024px.
- An article pane that reads the linked story in place: extracted reader text by default, or the page itself in a sandboxed frame. Three columns from 1,400px, an Article/Comments tab swap below that, and shareable as `&article=1`.
- An archive.is link wherever a story URL appears, for articles behind a paywall.
- Saved stories on their own tab, and a “Hide read” filter for each feed.
- Read indicators, preserved feed scroll, and browser Back/Forward navigation.
- Pointing at or focusing a story fetches the comments it opens with, so the click lands on a warm cache.
- Comments in HN order, 20 per batch, with replies fetched on expansion and collapsible threads.
- Keyboard shortcuts: `j` and `k` move through the list, `Enter` opens a discussion, `r` shows or hides the article pane, `o` opens the original article, `a` opens it on archive.is, `s` saves a story, `Escape` returns to the list, and `/` focuses search. `?` lists them all.
- System, light, and dark themes; locally hosted DM Sans and Newsreader fonts.
- Direct links such as `/item?id=8863&feed=top`, including compatibility with the old `/item?id=…` route.

Original articles, author profiles, and participation links open on their respective sites. Accounts, voting, posting, and offline reading are intentionally outside this version.

## Development and checks

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm run test:e2e
pnpm run build
pnpm run preview
```

Vitest covers the request cache, concurrency, ordering, failed requests, search-result mapping, and untrusted HTML. Playwright runs deterministic API fixtures on desktop Chromium and an emulated phone, covering reading, navigation, pagination, search, shortcuts, the article pane, saved stories, prefetching, themes, partial failures, and deep threads. Screenshots and traces for failed tests are saved under `test-results/`.

## Structure and data

`src/App.tsx` owns URL selection, theme, shortcuts, and the visited feed/discussion views. Components handle feed browsing, search results, and progressive comments; both story lists render through `src/components/StoryList.tsx`. `src/api.ts` centralizes requests to the [official Hacker News API](https://github.com/HackerNews/API) and to the [HN Algolia search API](https://hn.algolia.com/api), which supplies every field a result row shows, so results are not refetched story by story. Reader text comes from [r.jina.ai](https://jina.ai/reader/), which extracts an article as markdown; it is only called while the article pane is open, so the URL of a story reaches it only when the article is read there.

The client keeps a five-minute response cache, deduplicates concurrent requests, limits requests to eight at once, and times out stalled requests after 15 seconds — 30 for article extraction, which renders a page before answering. Refresh clears the data cache and reloads the current feed; stories do not reorder automatically. Up to ten recent discussions remain mounted to retain expanded threads and reading position. Feeds remain available for the current session.

Theme, article view, the “Hide read” setting, and the latest 2,000 opened and saved story IDs are saved in browser local storage. Storage failures do not prevent reading. There is no account sync, analytics, service worker, or server database. Story, comment, and extracted article HTML is sanitized with DOMPurify; unsafe article URLs are rejected. Embedded pages run in a sandboxed frame without `allow-same-origin`, and many sites decline to be framed at all.

## Hosting

`pnpm run build` produces `dist/`, including a `404.html` copy of `index.html`: GitHub Pages serves that file for unknown paths, which is what keeps direct discussion links working. `.github/workflows/pages.yml` runs the checks and publishes `dist/` to GitHub Pages from `main`; Pages must be set to the GitHub Actions source in the repository settings. A project site is served under `/<repository>/`, so the workflow passes that path to the build in `BASE_PATH`; the build defaults to the domain root otherwise. No deployment is performed by the build command itself.

This rebuild replaces the original Vue 2/Vuetify prototype. The original implementation remains in Git history.

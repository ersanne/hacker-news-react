# HN Reader

A quieter way to read Hacker News. A small, read-only React application with a desktop split view and a focused mobile reading screen.

## Run locally

Use **Node.js 22.12 or newer**. The exact version is pinned in `mise.toml` (and the major in `.nvmrc` for nvm users).

```sh
mise install
npm ci
npm run dev
```

With [mise](https://mise.jdx.dev) the scripts are also available as tasks: `mise run dev`, `build`, `test`, `test-e2e`, `typecheck`.

Vite prints the local URL. No API keys, environment variables, or backend are required.

## What it does

- Top, New, Best, Ask, and Show feeds, with 30 stories per batch and explicit refresh.
- Full-text search over the Hacker News archive, 30 results per page, shareable as `/?q=…`.
- Discussions beside the feed on desktop; a separate discussion screen below 1,024px.
- Read indicators, preserved feed scroll, and browser Back/Forward navigation.
- Comments in HN order, 20 per batch, with replies fetched on expansion and collapsible threads.
- Keyboard shortcuts: `j` and `k` move through the list, `Enter` opens a discussion, `o` opens the original article, `Escape` returns to the list, and `/` focuses search.
- System, light, and dark themes; locally hosted DM Sans and Newsreader fonts.
- Direct links such as `/item?id=8863&feed=top`, including compatibility with the old `/item?id=…` route.

Original articles, author profiles, and participation links open on their respective sites. Accounts, voting, posting, bookmarks, and offline reading are intentionally outside this version.

## Development and checks

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
npm run preview
```

Vitest covers the request cache, concurrency, ordering, failed requests, search-result mapping, and untrusted HTML. Playwright runs deterministic API fixtures on desktop Chromium and an emulated phone, covering reading, navigation, pagination, search, shortcuts, themes, partial failures, and deep threads. Screenshots and traces for failed tests are saved under `test-results/`.

## Structure and data

`src/App.tsx` owns URL selection, theme, shortcuts, and the visited feed/discussion views. Components handle feed browsing, search results, and progressive comments; both story lists render through `src/components/StoryList.tsx`. `src/api.ts` centralizes requests to the [official Hacker News API](https://github.com/HackerNews/API) and to the [HN Algolia search API](https://hn.algolia.com/api), which supplies every field a result row shows, so results are not refetched story by story.

The client keeps a five-minute response cache, deduplicates concurrent requests, limits requests to eight at once, and times out stalled requests after 15 seconds. Refresh clears the data cache and reloads the current feed; stories do not reorder automatically. Up to ten recent discussions remain mounted to retain expanded threads and reading position. Feeds remain available for the current session.

Theme and the latest 2,000 opened story IDs are saved in browser local storage. Storage failures do not prevent reading. There is no account sync, analytics, service worker, or server database. Story and comment HTML is sanitized with DOMPurify; unsafe article URLs are rejected.

## Hosting

`npm run build` produces `dist/`. Netlify settings and an SPA fallback are included. On another static host, route unknown paths to `index.html` so direct discussion links work. No deployment is performed by the build command.

This rebuild replaces the original Vue 2/Vuetify prototype. The original implementation remains in Git history.

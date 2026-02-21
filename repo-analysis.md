# Repository Analysis: `pixiv-dump`

## 1) What is this: worker, API server, or something else?

This repo is a **batch scraping worker / CLI job**, not an API server.

- Entry point is `src/index.ts`, which immediately runs scraping logic.
- There is no HTTP server framework (no Express/Fastify/Nest, no listen port).
- It is designed to run periodically (see `.github/workflows/continuousScrape.yaml`, scheduled every 6 hours).

## 2) How to run it

### Prerequisites

- Bun runtime
- Network access to `https://dic.pixiv.net/`

### Local run

1. Install dependencies:
   - `bun install`
2. Apply DB migrations:
   - `bun run migrate`
3. Start scraping:
   - `bun run start`

Optional timeout mode (graceful stop after N ms):

- `bun src/index.ts --timeout=3600000`

### Data location

- Prisma uses SQLite at `db/pixiv.db` (configured in `prisma/schema.prisma` as `file:../db/pixiv.db`).
- On successful full run, it writes `total.txt` with total article count.

## 3) Data flow of the most important operation

The main operation is the full scrape pipeline in `src/index.ts`:

1. `scrapeAllCategories()` phase (summary/index data):
   - Loops fixed Pixiv category list (`src/constants.ts`).
   - For each category, calls Pixiv JSON endpoint via:
     - `fetchPixivPage()` -> `fetchURL()` -> `axios.get(...)`
   - Parses article list response and upserts rows into `PixivArticle` via Prisma (`src/scrape/scrapeArticleList.ts`).
   - Maintains per-category resume markers (`scrapeProgress` table):
     - `newestScraped`, `oldestScraped`
     - Uses forward scan + binary search + backward scan (`src/scrape/scrapeAllCategories.ts`, `src/helpers/findPageNumberAtDate.ts`).

2. `scrapeAllIndividualArticles()` phase (detail/article-body data):
   - Selects articles that need detail refresh:
     - never scraped (`lastScrapedArticle IS NULL`)
     - or updated since last detail scrape (`lastScraped > lastScrapedArticle`)
   - For each selected `tag_name`:
     - Fetches article HTML page `/a/{tag_name}`.
     - Extracts Next.js `__NEXT_DATA__` JSON from HTML using JSDOM.
     - Pulls `yomigana`, breadcrumbs/categories, abstract/text.
     - Builds:
       - `reading`
       - `header` (breadcrumb/category hierarchy + tag name)
       - `mainText` (abstract + text)
     - Updates row in `PixivArticle`.
   - If 404, deletes the article row (`ArticleNotFoundError` path).

3. Completion / shutdown:
   - Disconnects Prisma client.
   - On successful completion, writes total count to `total.txt`.

## 4) Implementation details (core modules, libraries, etc.)

### Core modules

- `src/index.ts`
  - App orchestrator, timeout handling, SIGINT handling.
- `src/scrape/scrapeAllCategories.ts`
  - Incremental category scraping strategy, resume logic.
- `src/scrape/scrapeArticleList.ts`
  - Upsert summary rows into SQLite via Prisma.
- `src/scrape/scrapeAllIndividualArticles.ts`
  - Incremental detail scraping queue + progress bar.
- `src/scrape/scrapeSingleArticleInfo.ts`
  - HTML fetch + `__NEXT_DATA__` extraction and transformation.
- `src/helpers/lastScrapedHandler.ts`
  - Persist/compare per-category progress markers.
- `prisma/schema.prisma`
  - Data model (`PixivArticle`, `scrapeProgress`) and SQLite datasource.

### Main libraries and why they are used

- `@prisma/client` + `prisma`
  - ORM and migrations for SQLite.
- `axios` + `axios-retry`
  - HTTP calls with retry policy.
- `jsdom`
  - Parse HTML and read Next.js embedded JSON data.
- `yargs`
  - CLI argument parsing (`--timeout`).
- `cli-progress`
  - Progress bar for individual article scraping.
- Bun test/lint/format toolchain via scripts in `package.json`.

### Operational characteristics

- **Not event-driven / request-driven**; it is a long-running batch process.
- **Incremental and resumable**:
  - Category progress tracked in DB table `scrapeProgress`.
  - Detail refresh based on timestamp comparison fields.
- **Two-level data ingestion**:
  - Lightweight list API first.
  - Heavy detail HTML parsing second.
- **Persistence model**:
  - Single SQLite DB (`db/pixiv.db`), suited for artifact/release publishing workflow.

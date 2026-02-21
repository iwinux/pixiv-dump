# Bug Analysis

## Scope

This document consolidates analysis that happened **after** `repo-analysis.md`, focused on the failing CI/CD behavior and verification strategy.

Date of assessment: **2026-02-21**.

## Immediate Technical Direction Discussed

### Simplest implementation path for FlareSolverr

The simplest approach identified was:

- Route all outbound HTTP requests through a single chokepoint: `src/fetch/fetchURL.ts`.
- Keep all call sites unchanged.
- Replace direct `axios.get(url)` with a FlareSolverr `request.get` call.
- Parse response as JSON only when content type indicates JSON, otherwise return HTML text.

Reason this is minimal:

- One-file change.
- No scraping-module rewrites needed.
- Works for both list JSON endpoint and individual article HTML endpoint.

## GitHub Actions Health Assessment

Repository examined: `MarvNC/pixiv-dump`.

### Current status snapshot

- Latest `Scrape All` run: `22252013502` (created `2026-02-21T06:30:50Z`) -> **failure**
  - URL: `https://github.com/MarvNC/pixiv-dump/actions/runs/22252013502`
- Latest `Test` run: `22248780647` (created `2026-02-21T02:38:44Z`) -> **failure**
  - URL: `https://github.com/MarvNC/pixiv-dump/actions/runs/22248780647`
- Active runs at check time: **none**

### Trend analysis

- Recent sample:
  - `Scrape All`: 40/40 failed (sample window)
  - `Test`: 10/10 failed (sample window)
- Longer streak metrics:
  - `Scrape All`: failing streak = **153 runs**
    - Streak start: `2026-01-14T06:21:30Z`
    - Last success before streak: `2026-01-14T01:05:38Z`
  - `Test`: failing streak = **35 runs**
    - Streak start: `2026-01-18T09:59:58Z`
    - Last success before streak: `2026-01-18T09:45:31Z`

### Failed step consistency

- Recent `Scrape All` runs consistently fail at step **`Scrape`**.
- Recent `Test` runs consistently fail at step **`Run Tests`** (while `lint-and-format` passes).

## Root Cause Evidence

### `Scrape All` failure cause

From run logs (`22252013502`):

- `AxiosError: Request failed with status code 403`
- Response headers include Cloudflare markers (e.g., `server: cloudflare`)
- Response body is Cloudflare challenge page (`Just a moment...`, JS/cookie challenge)

This indicates egress requests from GitHub-hosted runners to Pixiv are being blocked/challenged.

### `Test` failure cause

From run logs (`22248780647`):

- Test job fails with the same `AxiosError 403` during live Pixiv request in `scrapeSingleArticleInfo.test.ts`.

### Non-blocking warning observed

- Workflow emits deprecated `set-output` warnings.
- This is not the immediate failure root cause; failures are caused by request blocking (403).

## Repository Ownership and Permission Findings

Authenticated account during analysis: `iwinux`.

Repository metadata for `MarvNC/pixiv-dump`:

- Owner: `MarvNC`
- Visibility: public
- Effective permissions for `iwinux`:
  - `pull: true`
  - `push: false`
  - `admin: false`
  - `maintain: false`
  - `triage: false`

Implication:

- You can read and open PRs, but cannot push directly to upstream or administer workflow settings there.

## Workflow Dispatch / PR Verification Constraints

### Is `Scrape All` a workflow?

Yes. It is defined at `.github/workflows/continuousScrape.yaml`.

### Trigger behavior of `Scrape All`

Current triggers:

- `schedule`
- `workflow_dispatch`

Not currently triggered by:

- `pull_request`

Implication:

- Opening a PR alone does **not** run `Scrape All`.

### Can `workflow_dispatch` target a branch?

Yes, `workflow_dispatch` supports selecting a branch (`ref`) when manually run.

Admin/upstream maintainer can run:

- UI branch picker in Actions.
- CLI equivalent: `gh workflow run continuousScrape.yaml --ref <branch>`.

Caveat:

- Target branch must exist in that repository context.
- If PR branch is only in a fork, upstream workflow dispatch cannot directly run that fork ref as an upstream branch.

## Running Verification on Your Fork

Yes, this is feasible and practical.

You can:

- Push fix to your fork branch.
- Manually run `Scrape All` on that branch in your fork via `workflow_dispatch`.

Expected limitation:

- Without changing egress behavior, GitHub-hosted runners will still likely hit Cloudflare 403.

## "Actions must be enabled on your fork" explained

For forked repos, GitHub Actions may be disabled or restricted by default.

To enable:

1. Open your fork -> `Settings` -> `Actions` -> `General`.
2. Select an allowed policy (e.g., allow actions/reusable workflows needed by this repo).
3. Save.
4. Open `Actions` tab and confirm workflows are enabled.
5. Verify `Run workflow` appears on `Scrape All`.

CLI checks:

- `gh workflow list -R <your-fork-owner>/pixiv-dump`
- `gh workflow run continuousScrape.yaml -R <your-fork-owner>/pixiv-dump --ref <branch>`

If Actions are disabled/restricted, dispatch will fail with policy/permission errors.

## Practical Conclusion

The primary production issue is not lint/build config; it is **network anti-bot blocking** (Cloudflare 403) for Pixiv requests in CI.  
The least invasive fix path discussed is centralizing FlareSolverr integration in `src/fetch/fetchURL.ts`, then validating through manual `workflow_dispatch` runs on a fork branch and/or maintainer-triggered runs upstream.

# Project Files

## JavaScript Files — scraper/

| File | Description |
|------|-------------|
| `scraper/index.js` | Main scraper — fetch pages → dedup by URL → lookup companies → upsert companies → upsert jobs (batch 500) → write not-found report + platform report (MD + JSON) |
| `scraper/api.js` | Peviitor API v1 operations — `searchCompanyByName`, `upsertCompany`, `upsertJobs`. Retry (3x) on transient errors. |
| `scraper/anaf.js` | Company resolution — ANAF search + company details, cuiscan/cuifirma fallback (no retries). Exports `getCompanyFromANAF`, `searchCompany`, `searchAndGetBestMatch` |
| `scraper/company-builder.js` | Builds company documents per the company model contract |
| `scraper/job-builder.js` | Builds job documents per the job model contract — extracts tags, workmode, salary, location |
| `scraper/not-found-report.js` | Generates `docs/companii-negasite.md` + `docs/companii-negasite.json` grouped by unresolved company (title, city, url) |
| `scraper/platform-report.js` | Classifies job-link domains (aggregator/ATS/company) and generates `docs/platforme.md` + `docs/platforme.json` |
| `scraper/web-search.js` | Website discovery for companies missing a website |
| `scraper/validators.js` | Validates company/job records against the models |
| `scraper/job-validator.js` | Job URL validation primitives — `validateByHead`, `validateByContent`, `DEFAULT_EXPIRED_KEYWORDS` |

## Test Files — tests/

| File | Description |
|------|-------------|
| `tests/unit/validators.test.js` | Unit tests for `scraper/validators.js` |

## Markdown Files

| File | Description |
|------|-------------|
| `ai/AGENTS.md` | Rules for AI agents working on this project |
| `ai/INSTRUCTIONS.md` | Project documentation — workflow, technologies, API endpoints, models update |
| `ai/job-model.md` | Job schema definition (Peviitor Core) — fields, types, validation rules |
| `ai/company-model.md` | Company schema definition (Peviitor Core) — fields, types, validation rules |
| `ai/files.md` | This file — documents role of each project file |
| `ai/MAINTENANCE.md` | Maintenance workflow for AI agents |
| `ai/VERIFY.md` | Step-by-step verification checklist after changes |
| `ai/ISSUES.md` | Issue tracking conventions |
| `docs/README.md` | Detailed project documentation |
| `docs/index.html` | GitHub Pages dashboard — shows aggregators + not-found companies (reads `platforme.json` / `companii-negasite.json`) |
| `docs/companii-negasite.md` / `.json` | **Generated reports** — companies not resolved + their jobs (committed by CI) |
| `docs/platforme.md` / `.json` | **Generated reports** — source platforms (aggregators / ATS / company sites) (committed by CI) |

## Configuration / Metadata

| File | Description |
|------|-------------|
| `package.json` | Node.js project config — dependencies (node-fetch, cheerio), scripts |
| `package-lock.json` | Locked dependency versions |
| `.npmrc` | npm configuration |
| `.gitignore` | Ignores node_modules/, tmp/, .env.local |
| `AGENTS.md` (root) | Brief agents instructions pointing to `ai/` |
| `company-model.md` / `job-model.md` (root) | Model schemas (kept in root for quick reference) |
| `.github/workflows/job-seeker-ro-spider.yml` | Daily scraping workflow (08:00) + manual — runs scraper + publishes report |
| `.github/workflows/automation-testing.yml` | Automated tests on push/PR/schedule |

## Data Files

| File | Description |
|------|-------------|
| `data/anaf-cache.json` | ANAF cache for company lookups |
| `docs/companii-negasite.md` / `.json` | Not-found company report — jobs that could NOT be uploaded because their company was not resolved |
| `docs/platforme.md` / `.json` | Source platforms report — aggregators, ATS and company sites encountered |

## Notes

- **All writes go through Peviitor API v1 only** — no direct Solr, no SOLR_AUTH.
- Job/company records must follow the contract exactly (no extra fields).
- Jobs whose company cannot be resolved are NOT uploaded — they land in `docs/companii-negasite.md`.

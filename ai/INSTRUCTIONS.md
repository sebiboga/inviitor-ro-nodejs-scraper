# Instructions

## Project Purpose

This scraper extracts job listings from **inviitor.ro** (a multi-company job board) and imports them to peviitor.ro.

Target: https://api.laurentiumarian.ro/mobile

This is a **multi-company** scraper — a single run imports jobs from hundreds of companies found in the inviitor.ro API.

## Model Schemas

The job and company models are defined in:
- `ai/job-model.md` - Job model schema
- `ai/company-model.md` - Company model schema

## Important

These models are **dynamic** and can change over time. They are based on the official Peviitor Core schemas which may be updated.

## How to Keep Models Updated

When working on this scraper:

1. **Check for updates** in the Peviitor Core repository:
   - Repository: https://github.com/peviitor-ro/peviitor_core
   - Main file: README.md (contains Job and Company model schemas)

2. **When to update**:
   - Before starting new development work
   - If field requirements or validations have changed
   - If new fields have been added

3. **How to update**:
   - Fetch the latest README.md from peviitor_core main branch
   - Compare with current `ai/job-model.md` and `ai/company-model.md`
   - Update local files if there are differences
   - Update `scraper/job-builder.js` and `scraper/company-builder.js` if field requirements changed

## Technologies

- **Node.js & JavaScript** - For scraping and data extraction
- **Peviitor API v1** - For data storage and retrieval (api.peviitor.ro) — **the ONLY way to write data** (no direct Solr, no SOLR_AUTH)
- **inviitor.ro API** - Public JSON API for job listings

## Workflow Steps

1. **Fetch jobs page** - `GET https://api.laurentiumarian.ro/mobile?page_size=50&page=N`
2. **Dedup by URL** - filter duplicate `job_link` with a local `Set`
3. **Lookup companies** - for each unique company name, resolve to a real legal entity:
   - Peviitor company core: `GET /v1/firme/company/?name=...`
   - ANAF search: `demoanaf.ro/api/search?q=...`
   - cuiscan/cuifirma fallback (no retries)
4. **Upsert companies** - only companies found in ANAF/peviitor; find website if missing
5. **Build job records** - follow the job model contract exactly (see `ai/job-model.md`)
6. **Upload jobs** - `POST /v1/scraper/jobs/upload/` in batches of 500
7. **Report skipped** - companies not found are written to `docs/companii-negasite.md` (their jobs are NOT uploaded)
8. **Report platforms** - job-link domains are classified and written to `docs/platforme.md` (aggregators / ATS / company sites)

## Key Decision: Jobs Without a Company Are NOT Uploaded

A job must have both `cif` and the company's legal name (`company`). If the company cannot be resolved:

- The job is **skipped** (not uploaded).
- It is collected in the not-found report: `docs/companii-negasite.md`.
- The report is committed to the repo by CI so it can be reviewed and the companies resolved manually (e.g. DECATHLON, CAREERJET).

## Running the Scraper

```bash
npm run scrape
# or
node scraper/index.js
```

Environment variables (all optional):

| Variable | Description | Default |
|----------|-------------|---------|
| `PAGE_SIZE` | Jobs per API page | 50 |
| `MAX_PAGES` | Max pages to scrape | 2000 |
| `MAX_TOTAL_JOBS` | Stop after N total jobs (0 = no limit) | 0 |
| `UPLOAD_BATCH` | Jobs per upload batch | 500 |

## Workflow Flowchart

```
inviitor.ro API (paginated, 50/page)
    │
    ▼
scraper/index.js
    │  dedupe by job_link (Set)
    ▼
lookupCompany(name) per unique company
    ├── Peviitor company core (GET /firme/company/?name=)
    ├── ANAF search (demoanaf.ro/api/search)
    └── cuiscan/cuifirma (fallback, no retries)
    │
    ├── company found ──► upsertCompany (PUT /firme/company/add/)
    │                        │
    │                        └──► buildJobRecord() ──► upsertJobs (POST /scraper/jobs/upload/, batch 500)
    │
    └── company NOT found ──► job skipped ──► docs/companii-negasite.md (committed by CI)

all job URLs ──► extractHostname() ──► classifyPlatform() ──► docs/platforme.md (committed by CI)
```

## File Responsibilities

| File | Role |
|------|------|
| `scraper/index.js` | Main entry point - fetch → dedup → lookup companies → upsert companies → upsert jobs → write report |
| `scraper/api.js` | Peviitor API v1 operations: `searchCompanyByName`, `upsertCompany`, `upsertJobs` (with retry) |
| `scraper/anaf.js` | Company resolution: ANAF search + company details, cuiscan/cuifirma fallback; `searchAndGetBestMatch` |
| `scraper/company-builder.js` | Builds company documents per the company model contract |
| `scraper/job-builder.js` | Builds job documents per the job model contract (extracts tags, workmode, salary) |
| `scraper/not-found-report.js` | Generates `docs/companii-negasite.md` + `docs/companii-negasite.json` grouped by unresolved company |
| `scraper/platform-report.js` | Classifies job-link domains (aggregator/ATS/company) and generates `docs/platforme.md` + `docs/platforme.json` |
| `scraper/web-search.js` | Website discovery for companies missing a website |
| `scraper/validators.js` | Validates company/job records |
| `scraper/job-validator.js` | Job URL validation primitives (`validateByHead`, `validateByContent`) |
| `tests/unit/validators.test.js` | Unit tests for validators |

## API Endpoints

- **inviitor.ro**: `https://api.laurentiumarian.ro/mobile?page_size=50&page=N` - public job listings
- **Peviitor v1**: `https://api.peviitor.ro/v1/` — ALL writes go through this API:
  - `GET /firme/company/?name=...` - search company core
  - `PUT /firme/company/add/` - upsert company
  - `POST /scraper/jobs/upload/` - upsert jobs (batch)
- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND` - search companies by name
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui` - get company details by CIF
- **CUIScan**: `https://cuiscan.ro/api.php?action=company&cui=CIF` - company details fallback
- **CUIFirma Search**: `https://cuifirma.ro/api/search?q=BRAND` - search fallback

## Rate Limiting & Politeness

| Setting | Value | Where |
|---------|-------|-------|
| Request timeout | 10000 ms | `scraper/anaf.js` — `TIMEOUT_MS` constant |
| ANAF fallback | 1 attempt ANAF → cuiscan/cuifirma | `scraper/anaf.js` — no retries, just fallback |
| User-Agent | `job_seeker_ro_spider` | Identifies the scraper in server logs |
| API retry | 3 attempts on transient errors | `scraper/api.js` — `request()` |

## Testing

```bash
npm test           # all tests
npm run test:unit  # unit tests only
```

## Technical Debt / Completed

- [x] Replace direct Solr access with Peviitor API v1 (no SOLR_AUTH)
- [x] Align job/company records with peviitor_core contract (no extra fields)
- [x] Not-found company report (`docs/companii-negasite.md`)
- [ ] Write more unit tests for `scraper/index.js` builder logic

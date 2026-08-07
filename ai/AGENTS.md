# AGENTS.md — Rules for AI agents

## Project
Multi-company scraper for inviitor.ro → peviitor.ro (Node.js, ESM, Jest)

## This Repo Is NOT a Template
This scraper imports **many companies at once** from one source (inviitor.ro). It is NOT derived from a single-company template and is NOT a template for deriving other scrapers.

## Critical Rules

### 1. Peviitor API v1 ONLY — never direct Solr
- All operations go through `https://api.peviitor.ro/v1`.
- **NEVER** add direct Solr access (`solr.peviitor.ro`) or `SOLR_AUTH`.
- **NEVER** use the v5 API. Only v1.

### 2. Job/company records must follow the peviitor_core contract EXACTLY
- Source of truth: `https://github.com/peviitor-ro/peviitor_core` README.md.
- Job fields allowed: `url, title, company, cif, location, tags, workmode, date, status` (+ optional `salary`, `vdate`, `expirationdate`). Plus `source` (e.g. `"inviitor.ro"`).
- Company fields allowed: `id, company, brand, group, status, location, website, career, lastScraped, scraperFile`.
- **NO extra fields** (no `id`, `job_title`, `company_name`, `city`, `county`, `country`, `workplaceType`, `remote`, `created_at`, `postingDate`, `published`, `address`, `anafData`, etc.). See `ai/job-model.md` and `ai/company-model.md`.

### 3. Company not found → do NOT upload the job
- A job **must** have a `cif` and the company's legal name (`company`) to be uploaded.
- If the company cannot be resolved, the job is **skipped** and added to `docs/companii-negasite.md` (grouped by company, with title/city/url).
- The report is committed to the repo by CI.

### 4. Company lookup order (no retries)
1. Peviitor company core — `GET /v1/firme/company/?name=...`
2. ANAF search — `demoanaf.ro/api/search?q=...`
3. cuiscan/cuifirma fallback — `cuiscan.ro/api.php?action=company&cui=...` / `cuifirma.ro/api/search?q=...`
- **Never retry** on ANAF errors; fall through to the next source.

### 5. Dedup by URL
- `url` (from `job_link`) is the unique key.
- Duplicate URLs across pages are filtered with a local `Set`.

### 6. inviitor.ro API pagination
- `https://api.laurentiumarian.ro/mobile?page_size=50&page=N`
- `404` or `400` = end of list (stop gracefully, do NOT treat as error).
- API returns **~65k records but only ~42k unique URLs** — duplicates between pages are normal.

### 7. User-Agent
- Every HTTP request uses `User-Agent: job_seeker_ro_spider`.

### 8. Batch uploads
- Jobs are uploaded in batches of 500 via `POST /v1/scraper/jobs/upload/`.

### 9. Environment
- No secrets needed. API v1 is public. No `.env.local` required.

### 10. Commit & Push
- `git add -A && git commit -m "..." && git push`
- Never `--force` push.
- Commit messages in the repo's style (Concise, English or Romanian summary).

### 11. Testing
```bash
npm test           # all tests
npm run test:unit  # unit tests only
```

### 12. Maintenance Agent
See [MAINTENANCE.md](MAINTENANCE.md). On every session, check open issues:
```bash
gh issue list --repo sebiboga/inviitor-ro-nodejs-scraper --state open
```
Prioritize: `critical` → `bug` → `enhancement` → `documentation`.

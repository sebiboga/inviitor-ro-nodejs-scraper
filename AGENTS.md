# inviitor-ro-nodejs-scraper

Scraper multi-companie pentru inviitor.ro. Descoperă companiile din API, le caută în ANAF și upsert în Solr.

## Flux

```
API inviitor.ro (paginated) → dedupe companies → ANAF lookup per company
→ build + validate company docs → build + validate job docs
→ upsert company core → upsert job core → verify
```

## Solr production schema (peviitor.ro)

### Company core
- `id`: `{cif}` (string)
- `company`: legal name (string)
- `cif`: plongs (number)
- `brand`: uppercase (string)
- `status`: activ/inactiv (string)
- `location`: text_general, multiValued
- `website`: string, multiValued
- `career`: string, multiValued
- `group`: "inviitor.ro" (string)
- `lastScraped`: YYYY-MM-DD (string)
- `scraperFile`: (string)
- `address`: text_general
- `anafData`: text_general (JSON string)
- `existingJobsCount`: plongs

### Job core
- `id`: `job-{cif}-{base64}`
- `url`: text_general
- `title`, `job_title`: text_general
- `company`: string (legal name)
- `company_name`: text_general (original API name)
- `cif`: string
- `location`, `city`, `country`, `county`: text_general
- `workmode`: string (remote/on-site/hybrid)
- `workplaceType`: text_general
- `status`: string
- `salary`, `remote`: text_general
- `date`, `vdate`, `expirationdate`, `created_at`, `postingDate`, `published`: pdate/pdates
- `tags`: text_general, multiValued
- `source`: text_general ("inviitor.ro")

## ANAF API (June 2026)
- Search: `demoanaf.ro/api/search?q={name}` → JSON `{success, data}`
- Details: `demoanaf.ro/api/company/{cif}` → JSON `{success, data}`

## CI
GitHub Actions daily la 08:00. Secret: `SOLR_AUTH=solr:SolrRocks`

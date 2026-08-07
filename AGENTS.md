# inviitor-ro-nodejs-scraper

Scraper multi-companie pentru inviitor.ro → peviitor.ro. Job-urile din API-ul inviitor.ro sunt importate în peviitor prin **API-ul peviitor v1** (fără acces direct Solr, fără SOLR_AUTH).

## Flux

```
API inviitor.ro (paginated) → dedupe URL → lookup company (peviitor v1 → ANAF → cuiscan/cuifirma)
→ upsert company (PUT /v1/firme/company/add/)
→ upsert jobs (POST /v1/scraper/jobs/upload/, batch 500)
→ companii negăsite → docs/companii-negasite.md
```

## Reguli critice

- **Doar API peviitor v1** (`api.peviitor.ro/v1`). Fără Solr direct, fără SOLR_AUTH, fără v5.
- Job/company records respectă **exact contractul** din `peviitor-ro/peviitor_core` (fără câmpuri în plus).
- Job fără cif/nume legal de companie → **NU se uploadează**, merge în `docs/companii-negasite.md`.
- User-Agent: `job_seeker_ro_spider` pe toate request-urile.
- Dedup după `job_link` (uniqueKey). 404/400 din API = sfârșitul paginării.

## Documentație AI

Vezi `ai/` pentru regulile complete: [AGENTS.md](ai/AGENTS.md), [INSTRUCTIONS.md](ai/INSTRUCTIONS.md), [MAINTENANCE.md](ai/MAINTENANCE.md), [VERIFY.md](ai/VERIFY.md), [files.md](ai/files.md), [job-model.md](ai/job-model.md), [company-model.md](ai/company-model.md).

## API-uri

| API | URL | Autentificare |
|---|---|---|
| inviitor.ro | `https://api.laurentiumarian.ro/mobile` | Public |
| Peviitor v1 | `https://api.peviitor.ro/v1/` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| cuiscan | `https://cuiscan.ro/api.php` | Public |
| cuifirma | `https://cuifirma.ro/api/search` | Public |

## Comenzi

```bash
npm run scrape   # Rulează scraperul
npm test         # Toate testele
npm run test:unit
```

## CI

GitHub Actions zilnic la 08:00 + manual (`workflow_dispatch`). Nu necesită secrete.

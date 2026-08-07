# inviitor.ro Scraper — documentation

**inviitor-ro-nodejs-scraper** — scraper multi-companie pentru job-urile de pe [inviitor.ro](https://www.inviitor.ro), publicate în [peviitor.ro](https://peviitor.ro) prin API-ul peviitor (v1).

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Fetch-uiește job-urile** — API-ul public inviitor.ro (paginated, 50 job-uri/pagină) care conține job-uri de la sute de companii
2. **Dedupe la nivel de URL** — `job_link` este uniqueKey; duplicatele dintre pagini sunt filtrate cu un Set local
3. **Caută companiile** — fiecare companie descoperită e căutată mai întâi în company core (API peviitor v1), apoi în ANAF/cuiscan/cuifirma
4. **Upsert companii** — `PUT /v1/firme/company/add/`, cu website găsit automat (web search) când lipsește
5. **Upsert job-uri în batch** — `POST /v1/scraper/jobs/upload/` (batch-uri de 500), fără acces direct la Solr

## Structură proiect

```
├── scraper/
│   ├── index.js             # Orchestrator principal
│   ├── api.js               # API peviitor v1 (search company, upsert company/jobs)
│   ├── anaf.js              # Căutare companie: ANAF → cuiscan → cuifirma
│   ├── company-builder.js   # Construiește documentul company
│   ├── job-builder.js       # Construiește documentul job
│   ├── job-validator.js     # validateByHead / validateByContent
│   ├── markdown-generator.js
│   ├── validators.js        # Validare company/job records
│   └── web-search.js        # Website fallback (URL patterns + DuckDuckGo)
├── tests/
│   └── unit/                # Teste unitare
├── docs/                    # Documentație + rezultate teste
└── .github/workflows/
    ├── job-seeker-ro-spider.yml    # Rulează zilnic la 08:00 + manual
    └── automation-testing.yml      # Teste la push
```

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| inviitor.ro | `https://api.laurentiumarian.ro/mobile` | Public |
| Peviitor v1 | `https://api.peviitor.ro/v1/` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| cuiscan | `https://cuiscan.ro/api.php` | Public |
| cuifirma | `https://cuifirma.ro/api/search` | Public |

Nu se mai folosește acces direct la Solr și nici secretul `SOLR_AUTH` — toate upsert-urile trec prin API-ul peviitor v1.

## Flux

```
API inviitor.ro (paginated) → dedupe URL (Set local)
→ lookup company (peviitor v1 → ANAF/cuiscan/cuifirma)
→ upsert company (PUT /firme/company/add/)
→ upsert jobs (POST /scraper/jobs/upload/, batch 500)
```

## Testare

```bash
npm test           # toate testele
npm run test:unit  # doar unitare
```

## CI

GitHub Actions rulează zilnic la 08:00 (UTC+3) și manual (`workflow_dispatch`). Nu necesită secrete — API-ul peviitor v1 e public.

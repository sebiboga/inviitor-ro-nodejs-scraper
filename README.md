# inviitor-ro-nodejs-scraper

Scraper multi-companie pentru job-urile de pe [inviitor.ro](https://inviitor.ro) în sistemul [peviitor.ro](https://peviitor.ro), prin API-ul peviitor v1.

## Cum funcționează

1. Fetch paginat din API-ul `api.laurentiumarian.ro/mobile`
2. Deduplicare job-uri după `job_link` (Set local)
3. Lookup companii: company core (peviitor v1) → ANAF/cuiscan/cuifirma
4. Upsert companii prin `PUT /v1/firme/company/add/`
5. Upsert job-uri în batch-uri de 500 prin `POST /v1/scraper/jobs/upload/`

Fără acces direct la Solr și fără `SOLR_AUTH` — totul trece prin API-ul public peviitor v1.

## Comenzi

```bash
npm run scrape   # Rulează scraperul
npm test         # Rulează toate testele
```

## Structură

```
scraper/
  index.js             # Orchestrator principal
  api.js               # API peviitor v1 (search company, upsert company/jobs)
  anaf.js              # Căutare companie: ANAF → cuiscan → cuifirma
  company-builder.js   # Construiește documente company
  job-builder.js       # Construiește documente job
  validators.js        # Validare contra modelelor
tests/
  unit/                # Teste unitare
docs/
  README.md            # Documentație detaliată
```

## Output

- Job-uri și companii în sistemul peviitor.ro prin API-ul public v1
- Vizibil pe [peviitor.ro](https://peviitor.ro)

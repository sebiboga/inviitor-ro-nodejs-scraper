# inviitor-ro-nodejs-scraper

Scraper pentru job-urile de pe [inviitor.ro](https://inviitor.ro) în sistemul [peviitor.ro](https://peviitor.ro).

## Cum funcționează

1. Fetch paginat din API-ul `api.laurentiumarian.ro/mobile`
2. Deduplicare companii
3. Lookup ANAF pentru fiecare companie (nume legal, CIF, status)
4. Validare contra modelelor (company-model.md, job-model.md)
5. Upsert în Solr producție (`solr.peviitor.ro`)
6. Verificare

## Comenzi

```bash
npm run scrape   # Rulează scraperul
npm test         # Rulează toate testele
```

## Structură

```
index.js              # Orchestrator principal
solr.js               # Interfață Solr (query/upsert)
src/
  anaf.js             # Lookup ANAF
  company-builder.js  # Construiește documente company
  job-builder.js      # Construiește documente job
  validators.js       # Validare contra modelelor
tests/
  unit/               # Teste unitare
```

## Output

- Date în `solr.peviitor.ro` (core-urile `company` și `job`)
- Vizibil pe [peviitor.ro](https://peviitor.ro) prin API-ul public

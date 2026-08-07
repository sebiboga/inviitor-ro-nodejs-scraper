# Verification Steps

After making changes to this repo, run through these steps in order.

## 1. Rulează testele local

```bash
npm test
npm run test:unit
```

Toate testele trebuie să treacă (0 failed).

## 2. Rulează scraperul local cu subset mic

```bash
cd /home/sebi/inviitor-ro-nodejs-scraper
MAX_PAGES=2 node --no-deprecation scraper/index.js
```

Verifică:

- Job-urile se uploadează prin API (fără erori)
- `docs/companii-negasite.md` se generează corect (companii negăsite + job-urile lor)
- Nu apar câmpuri în plus în job/company records (doar contract + `source`)

## 3. Rulează scraperul complet local (opțional)

```bash
node --no-deprecation scraper/index.js
```

Durată estimată: ~25-30 min pentru toate paginile (~42k job-uri unice). Rulează în fundal cu `setsid` și log în fișier:

```bash
setsid node --no-deprecation scraper/index.js > /tmp/opencode/inviitor-full.log 2>&1 < /dev/null &
```

## 4. Rulează prin GitHub Actions

1. Mergi la **Actions** → **inviitor.ro Scraper** (`job-seeker-ro-spider.yml`)
2. Apasă **Run workflow** → lasă `main`
3. Așteaptă să se termine (toate job-urile green)
4. Verifică că step-ul "Publish docs/companii-negasite.md" a făcut commit

## 5. Verifică rezultatul

- `docs/companii-negasite.md` pe GitHub — companiile negăsite cu job-urile lor
- Pe https://peviitor.ro că job-urile inviitor.ro sunt vizibile

## 6. Final

Dacă toți pașii de mai sus sunt verzi, modificarea e gata de merge.

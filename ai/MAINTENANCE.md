# Maintenance Agent

## Purpose

The Maintenance Agent keeps the inviitor.ro scraper healthy, up-to-date, and bug-free. It monitors open issues, validates the peviitor contract, and applies fixes.

## Routine Tasks

### 1. Check GitHub Issues

Before any work, check open issues:

```bash
gh issue list --repo sebiboga/inviitor-ro-nodejs-scraper --state open
```

- Prioritize `critical` label issues first
- Then `bug` label issues
- Then `enhancement` and `documentation`

### 2. Fix All Open Issues

For each open issue:

1. Read the issue body carefully
2. Checkout the repo if not already in it
3. Investigate the root cause (check file paths, field names, schemas)
4. Apply the fix
5. Run relevant tests to verify
6. Commit with issue reference (e.g., `fix: resolve #20`)
7. Push
8. Close the issue with a comment linking the commit

### 3. Validate Peviitor Contract / Schema

After any code change that touches `scraper/job-builder.js` or `scraper/company-builder.js`:

- Verify field names match `ai/job-model.md` and `ai/company-model.md` (which mirror peviitor_core).
- Check ALL consumers (workflows, docs, tests) use the correct field names.
- **Rule of thumb:** only contract fields + `source`. No `id`, `job_title`, `company_name`, `city`, `county`, `country`, `workplaceType`, `remote`, `created_at`, `postingDate`, `published` on jobs.

### 4. Validate Workflows

After any workflow change:

```bash
# Check workflow syntax
actionlint .github/workflows/*.yml || true

# Verify no SOLR_AUTH is referenced
grep -n "SOLR_AUTH\|solr.peviitor.ro" .github/workflows/*.yml
```

The scraper step MUST NOT use `SOLR_AUTH`. Verify step may check results via the API.

### 5. Validate Documentation

Ensure docs match reality:

- `ai/files.md` — file paths and descriptions must match actual files
- `ai/job-model.md` / `ai/company-model.md` — must match peviitor_core README
- `docs/README.md` — project structure tree must include all directories
- `docs/companii-negasite.md` — regenerated on each run; committed by CI

### 6. Run Full Test Suite

Before any merge or after fixing issues:

```bash
npm test
```

Fix any failures before proceeding.

### 7. Review the Not-Found Report

After each run, check `docs/companii-negasite.md`:

- Companies listed there could not be resolved to a real legal entity.
- Common cases:
  - **Aggregator/recruiter names** (e.g. CAREERJET) — not a real hiring company, likely fine to keep skipping.
  - **Real companies the lookup missed** (e.g. DECATHLON) — improve the lookup in `scraper/anaf.js` or `scraper/index.js`.
- Add the CIF manually if the company is known, or improve matching.

### 8. Clean Up Stale Files

- Remove tracked files that are gitignored (e.g. `test-report.html`)
- Delete empty directories that shouldn't exist (e.g. `tmp/`)
- Remove old path references in comments and docs (`src/` → `scraper/`)

## Issue Triage

| Priority | Action |
|----------|--------|
| `critical` | Fix immediately — breaks CI or production |
| `bug` | Fix in next session |
| `enhancement` | Schedule for next sprint |
| `documentation` | Fix when convenient |
| `good first issue` | Delegate or batch with other low-priority work |

## Escalation

If an issue cannot be resolved (e.g., external API broken, inviitor.ro API down):

1. Add a comment explaining the blocker
2. Label it `wontfix` or `question` as appropriate
3. Move on to the next issue

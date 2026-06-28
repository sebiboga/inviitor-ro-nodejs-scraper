import fetch from "node-fetch";
import { searchAndGetBestMatch } from "./src/anaf.js";
import { buildCompanyRecord } from "./src/company-builder.js";
import { buildJobRecord } from "./src/job-builder.js";
import { validateCompanyRecord, validateJobRecord } from "./src/validators.js";
import { upsertSolrDocs, findCompanyInSolr, jobUrlExists } from "./solr.js";

const API_BASE = "https://api.laurentiumarian.ro/mobile";
const PAGE_SIZE = 50;
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "1500", 10);

async function fetchJobsPage(page) {
  const url = `${API_BASE}/?page_size=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": "job_seeker_ro_spider" } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (data.detail === "Invalid page.") return [];
  return data.results || data;
}

async function resolveCompany(name) {
  // 1. Try Solr company core first (already indexed, no API calls)
  try {
    const solrCompany = await findCompanyInSolr(name);
    if (solrCompany) {
      console.log(`  ✅ ${name}: found in Solr company core`);
      const brand = name;
      const companyRecord = buildCompanyRecord(solrCompany, brand, { group: solrCompany._solrGroup || "" });
      const v = validateCompanyRecord(companyRecord);
      if (v.valid) {
        // include _anafParsed so buildJobRecord can use full ANAF data if available
        const anaf = solrCompany._anafParsed || solrCompany;
        return { anaf, brand, companyRecord, fromSolr: true };
      }
    }
  } catch {}

  // 2. Fallback: ANAF → CUIFirma → cache
  let anaf = null;
  try {
    anaf = await searchAndGetBestMatch(name);
  } catch (err) {
    console.log(`  ⏭️ ${name}: ANAF error (${err.message})`);
    return null;
  }
  if (!anaf) {
    console.log(`  ⏭️ ${name}: no ANAF match`);
    return null;
  }
  const brand = name;
  const companyRecord = buildCompanyRecord(anaf, brand, { group: "" });
  const v = validateCompanyRecord(companyRecord);
  if (!v.valid) {
    console.log(`  ⚠️ ${name}: validation failed: ${v.errors.join(", ")}`);
    return null;
  }
  return { anaf, brand, companyRecord, fromSolr: false };
}

async function run() {
  console.log("=== inviitor.ro Scraper ===");
  let totalJobs = 0;
  let totalCompanies = 0;
  const companyCache = {};

  for (let page = 1; page <= MAX_PAGES; page++) {
    // 1. Fetch one page
    const jobs = await fetchJobsPage(page);
    if (!jobs.length) {
      console.log(`  Page ${page}: no jobs → done`);
      break;
    }

    // 2. Filter out jobs already indexed (by URL)
    const newJobs = [];
    for (const job of jobs) {
      const url = job.job_link || job.url || "";
      if (!url) { newJobs.push(job); continue; }
      const exists = await jobUrlExists(url);
      if (exists) continue;
      newJobs.push(job);
    }
    const skipped = jobs.length - newJobs.length;
    console.log(`\n--- Page ${page}: ${jobs.length} jobs (${newJobs.length} new, ${skipped} skipped) ---`);
    if (!newJobs.length) continue;

    // 3. Resolve companies (cache reuse)
    const uniqueNames = [...new Set(newJobs.map(j => j.company_name).filter(Boolean))];
    for (const name of uniqueNames) {
      if (!companyCache[name]) {
        console.log(`  Resolving: ${name}`);
        companyCache[name] = await resolveCompany(name);
      }
    }

    // 4. Build Solr docs
    const companies = {};
    const jobDocs = [];

    for (const job of newJobs) {
      const name = job.company_name;
      const resolved = companyCache[name];
      if (!resolved) continue;

      const jobRecord = buildJobRecord(job, resolved.anaf, resolved.brand);
      const v = validateJobRecord(jobRecord);
      if (!v.valid) {
        console.log(`  ⚠️ Job validation failed: ${v.errors.join(", ")}`);
        continue;
      }
      jobDocs.push(jobRecord);

      const coKey = resolved.companyRecord.id;
      // Skip company upsert if it was already in Solr (no need to re-index)
      if (resolved.fromSolr) continue;
      if (!companies[coKey]) {
        companies[coKey] = { ...resolved.companyRecord, existingJobsCount: 0 };
      }
      companies[coKey].existingJobsCount++;
    }

    const companyList = Object.values(companies).map(co => {
      co.existingJobsCount = co.existingJobsCount || 0;
      return co;
    });

    // 5. Upsert this batch (only new companies, only new jobs)
    if (companyList.length) {
      const r = await upsertSolrDocs("company", companyList);
      console.log(`  → ${companyList.length} companies upserted: ${r.status}`);
    }
    if (jobDocs.length) {
      const r = await upsertSolrDocs("job", jobDocs);
      console.log(`  → ${jobDocs.length} jobs upserted: ${r.status}`);
    }

    totalJobs += jobDocs.length;
    totalCompanies += companyList.length;
  }

  // 5. Final verification
  console.log("\n=== Done ===");
  console.log(`Total companies upserted: ${totalCompanies}`);
  console.log(`Total jobs upserted: ${totalJobs}`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

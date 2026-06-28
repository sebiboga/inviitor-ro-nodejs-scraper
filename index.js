import fetch from "node-fetch";
import { searchAndGetBestMatch } from "./src/anaf.js";
import { buildCompanyRecord } from "./src/company-builder.js";
import { buildJobRecord } from "./src/job-builder.js";
import { validateCompanyRecord, validateJobRecord } from "./src/validators.js";
import { upsertSolrDocs } from "./solr.js";

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
  const companyRecord = buildCompanyRecord(anaf, brand);
  const v = validateCompanyRecord(companyRecord);
  if (!v.valid) {
    console.log(`  ⚠️ ${name}: validation failed: ${v.errors.join(", ")}`);
    return null;
  }
  return { anaf, brand, companyRecord };
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
    console.log(`\n--- Page ${page}: ${jobs.length} jobs ---`);

    // 2. Resolve companies (cache reuse)
    const uniqueNames = [...new Set(jobs.map(j => j.company_name).filter(Boolean))];
    for (const name of uniqueNames) {
      if (!companyCache[name]) {
        console.log(`  Resolving: ${name}`);
        companyCache[name] = await resolveCompany(name);
      }
    }

    // 3. Build Solr docs
    const companies = {};
    const jobDocs = [];

    for (const job of jobs) {
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
      if (!companies[coKey]) {
        companies[coKey] = { ...resolved.companyRecord, existingJobsCount: 0 };
      }
      companies[coKey].existingJobsCount++;
    }

    const companyList = Object.values(companies).map(co => {
      co.existingJobsCount = co.existingJobsCount || 0;
      return co;
    });

    // 4. Upsert this batch
    if (companyList.length) {
      const r = await upsertSolrDocs("company", companyList);
      console.log(`  → ${companyList.length} companies: ${r.status}`);
    }
    if (jobDocs.length) {
      const r = await upsertSolrDocs("job", jobDocs);
      console.log(`  → ${jobDocs.length} jobs: ${r.status}`);
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

import fetch from "node-fetch";
import { searchAndGetBestMatch } from "./src/anaf.js";
import { buildCompanyRecord } from "./src/company-builder.js";
import { buildJobRecord } from "./src/job-builder.js";
import { validateCompanyRecord, validateJobRecord } from "./src/validators.js";
import { upsertSolrDocs } from "./solr.js";

const API_BASE = "https://api.laurentiumarian.ro/mobile";
const PAGE_SIZE = 50;
const MAX_PAGES = 2;

async function fetchJobsPage(page) {
  const url = `${API_BASE}/?page_size=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": "job_seeker_ro_spider" } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
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

  // 1. Fetch jobs
  console.log("\n--- Fetching jobs ---");
  let allJobs = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const jobs = await fetchJobsPage(page);
    allJobs = allJobs.concat(jobs);
    console.log(`  Page ${page}: ${jobs.length} jobs`);
  }
  console.log(`Total: ${allJobs.length} jobs`);

  // 2. Resolve unique companies
  console.log("\n--- Resolving companies via ANAF ---");
  const uniqueNames = [...new Set(allJobs.map(j => j.company_name).filter(Boolean))];
  console.log(`Unique companies: ${uniqueNames.length} (${uniqueNames.join(", ")})`);

  const companyCache = {};
  for (const name of uniqueNames) {
    console.log(`\n  ${name}:`);
    companyCache[name] = await resolveCompany(name);
  }

  // 3. Build Solr docs
  console.log("\n--- Building Solr documents ---");
  const companies = {};
  const jobs = [];

  for (const job of allJobs) {
    const name = job.company_name;
    const resolved = companyCache[name];
    if (!resolved) continue;

    const jobRecord = buildJobRecord(job, resolved.anaf, resolved.brand);
    const v = validateJobRecord(jobRecord);
    if (!v.valid) {
      console.log(`  ⚠️ Job validation failed: ${v.errors.join(", ")}`);
      continue;
    }
    jobs.push(jobRecord);

    const coKey = resolved.companyRecord.id;
    if (!companies[coKey]) {
      companies[coKey] = { ...resolved.companyRecord, existingJobsCount: 0 };
    }
    companies[coKey].existingJobsCount++;
  }

  // Update job counts
  const companyList = Object.values(companies);
  companyList.forEach(co => {
    co.existingJobsCount = co.existingJobsCount || 0;
  });

  console.log(`Companies to upsert: ${companyList.length}`);
  console.log(`Jobs to upsert: ${jobs.length}`);

  // 4. Upsert to Solr
  console.log("\n--- Upserting to Solr ---");
  if (companyList.length) {
    const r = await upsertSolrDocs("company", companyList);
    console.log(`  Companies: ${r.status} ${r.statusText} (${r.body})`);
  }
  if (jobs.length) {
    const r = await upsertSolrDocs("job", jobs);
    console.log(`  Jobs: ${r.status} ${r.statusText} (${r.body})`);
  }

  // 5. Verify
  console.log("\n--- Verification ---");
  const { querySOLR } = await import("./solr.js");
  for (const co of companyList.slice(0, 3)) {
    const result = await querySOLR(co.cif);
    const count = result?.numFound || 0;
    console.log(`  ${co.company}: ${count} jobs in Solr ${count > 0 ? "✅" : "❌"}`);
  }

  console.log("\n=== Done ===");
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

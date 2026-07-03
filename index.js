import fetch from "node-fetch";
import { upsertSolrDocs, jobUrlExists, findCompanyInSolr, upsertCompany } from "./solr.js";
import { searchAndGetBestMatch } from "./src/anaf.js";
import { buildCompanyRecord } from "./src/company-builder.js";
import { findWebsite } from "./src/web-search.js";

const companyCache = {};

const API_BASE = "https://api.laurentiumarian.ro/mobile";
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || "50", 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "2000", 10);
const MAX_TOTAL_JOBS = parseInt(process.env.MAX_TOTAL_JOBS || "0", 10);
let apiRequestCount = 0;

async function rateLimitedRequest(url, options = {}) {
  apiRequestCount++;
  if (apiRequestCount % 300 === 0) {
    console.log(`  ⏳ Rate limit pause (${apiRequestCount} API requests so far)...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  return fetch(url, options);
}

const DIACRITICS_MAP = {
  ă: "a", â: "a", î: "i", ș: "s", ț: "t",
  Ă: "A", Â: "A", Î: "I", Ș: "S", Ț: "T",
};

function removeDiacritics(s) {
  return s.replace(/[ăâîșțĂÂÎȘȚ]/g, ch => DIACRITICS_MAP[ch] || ch);
}

function cleanCity(cityRaw) {
  if (!cityRaw) return "";
  return cityRaw.split(",")[0].trim();
}

function extractTags(title, companyName) {
  const tagSet = new Set();
  const cleanCo = removeDiacritics(companyName.toLowerCase()).trim();
  if (cleanCo) tagSet.add(cleanCo);
  tagSet.add("inviitor.ro");
  if (title) {
    const words = removeDiacritics(title.toLowerCase())
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !["pentru","pent","prin","dupa","chiar","care","catre","este","sunt","fara","mai","mult","foarte","peste","toate","toata","toate","sub","pana"].includes(w));
    for (const w of words.slice(0, 10)) {
      if (tagSet.size >= 20) break;
      tagSet.add(w);
    }
  }
  return [...tagSet].slice(0, 20);
}

async function lookupCompany(companyName) {
  const upper = companyName.toUpperCase().trim();
  if (companyCache[upper]) return companyCache[upper];

  // Try Solr company core first
  try {
    const fromSolr = await findCompanyInSolr(companyName);
    if (fromSolr && fromSolr.cif) {
      companyCache[upper] = fromSolr;
      return fromSolr;
    }
  } catch {}

  // Fallback: ANAF / cuifirme.ro
  try {
    const fromAnaf = await searchAndGetBestMatch(companyName);
    if (fromAnaf && fromAnaf.cif) {
      companyCache[upper] = fromAnaf;
      return fromAnaf;
    }
  } catch {}

  companyCache[upper] = null;
  return null;
}

function buildJobRecord(rawJob, companyInfo) {
  const url = rawJob.job_link || "";
  const title = (rawJob.job_title || "").trim() || "Unknown Position";
  const rawCompany = (rawJob.company_name || "").trim() || "Unknown Company";
  const companyName = (companyInfo && companyInfo.company) ? companyInfo.company.toUpperCase().trim() : rawCompany.toUpperCase();
  const cif = (companyInfo && companyInfo.cif) ? String(companyInfo.cif) : "";
  const cityRaw = (rawJob.city || "").trim() || "";
  const city = cleanCity(cityRaw);
  const remoteVal = (rawJob.remote || "").trim() || "";

  const location = city ? [`${city}, Romania`] : ["Romania"];

  let workmode = "on-site";
  const rl = remoteVal.toLowerCase();
  if (rl.includes("remote") || rl.includes("hybrid")) {
    workmode = rl.includes("hybrid") ? "hybrid" : "remote";
  }

  let salary = "";
  const smin = rawJob.salary_min;
  const smax = rawJob.salary_max;
  const scurr = rawJob.salary_currency || "RON";
  if (smin != null && smax != null) {
    salary = `${smin}-${smax} ${scurr}`;
  } else if (smin != null) {
    salary = `${smin} ${scurr}`;
  } else if (smax != null) {
    salary = `${smax} ${scurr}`;
  }

  const now = new Date();

  const record = {
    url,
    title,
    company: companyName,
    cif,
    location,
    tags: extractTags(title, companyName),
    workmode,
    date: now.toISOString(),
    status: "scraped",
    source: "inviitor.ro",
  };
  if (salary) record.salary = salary;
  return record;
}

async function fetchJobsPage(page) {
  const url = `${API_BASE}/?page_size=${PAGE_SIZE}&page=${page}`;
  const res = await rateLimitedRequest(url, { headers: { "User-Agent": "job_seeker_ro_spider" } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (data.detail === "Invalid page.") return [];
  return data.results || data;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log("=== inviitor.ro → peviitor Solr (job core only) ===");
  let totalNew = 0;
  let totalSkipped = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const jobs = await fetchJobsPage(page);
    if (!jobs.length) {
      console.log(`Page ${page}: no jobs → done`);
      break;
    }

    const results = await Promise.all(jobs.map(async (job) => {
      const url = job.job_link || "";
      if (!url) return { job, exists: true };
      const exists = await jobUrlExists(url);
      return { job, exists };
    }));
    const newJobs = results.filter(r => !r.exists).map(r => r.job);
    totalSkipped += results.filter(r => r.exists).length;

    console.log(`Page ${page}: ${jobs.length} jobs (${newJobs.length} new, ${jobs.length - newJobs.length} skipped)`);

    if (!newJobs.length) continue;

    // Look up companies in parallel (deduplicated by name)
    const uniqueCompanies = [...new Set(newJobs.map(j => (j.company_name || "").trim().toUpperCase()).filter(Boolean))];
    const companyInfos = await Promise.all(uniqueCompanies.map(async name => {
      const info = await lookupCompany(name);
      return { name, info };
    }));
    const companyMap = {};
    for (const ci of companyInfos) {
      companyMap[ci.name] = ci.info;
    }

    // Upsert companii noi în company core
    for (const ci of companyInfos) {
      if (!ci.info) continue;
      try {
        const companyDoc = buildCompanyRecord(ci.info, ci.name, { scraperFile: "inviitor-ro-nodejs-scraper" });
        if (!companyDoc.website || !companyDoc.website.length) {
          const foundUrl = await findWebsite(ci.info.company || ci.name, ci.name);
          if (foundUrl) {
            companyDoc.website = [foundUrl];
            console.log(`  🌐 Website găsit pentru ${ci.name}: ${foundUrl}`);
          }
        }
        await upsertCompany(companyDoc);
      } catch (e) {
        console.log(`  ⚠️ Nu am putut upserta compania ${ci.name}: ${e.message}`);
      }
    }

    const jobDocs = newJobs.map(job => {
      const rawName = (job.company_name || "").trim().toUpperCase();
      const record = buildJobRecord(job, companyMap[rawName]);
      if (record.title.length > 200) record.title = record.title.slice(0, 200);
      return record;
    });

    if (jobDocs.length) {
      const r = await upsertSolrDocs("job", jobDocs);
      console.log(`  → ${jobDocs.length} jobs upserted: ${r.status}`);
    }

    totalNew += jobDocs.length;
    if (MAX_TOTAL_JOBS > 0 && totalNew >= MAX_TOTAL_JOBS) {
      console.log(`Reached limit of ${MAX_TOTAL_JOBS} new jobs, stopping.`);
      break;
    }
  }

  console.log("\n=== Done ===");
  console.log(`New jobs upserted: ${totalNew}`);
  console.log(`Skipped (already in Solr): ${totalSkipped}`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

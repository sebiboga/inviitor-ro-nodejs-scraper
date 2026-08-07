import fetch from "node-fetch";
import { searchCompanyByName, upsertCompany, upsertJobs } from "./api.js";
import { searchAndGetBestMatch } from "./anaf.js";
import { buildCompanyRecord } from "./company-builder.js";
import { buildJobRecord } from "./job-builder.js";
import { findWebsite } from "./web-search.js";

const companyCache = {};

const API_BASE = "https://api.laurentiumarian.ro/mobile";
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || "50", 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "2000", 10);
const MAX_TOTAL_JOBS = parseInt(process.env.MAX_TOTAL_JOBS || "0", 10);
const UPLOAD_BATCH = parseInt(process.env.UPLOAD_BATCH || "500", 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalizePeviitorCompany(apiCompany) {
  const cif = parseInt(apiCompany.id) || 0;
  const location = Array.isArray(apiCompany.location) ? apiCompany.location : [];
  const website = Array.isArray(apiCompany.website) ? apiCompany.website : [];
  return {
    cif,
    cui: cif,
    denumire: apiCompany.company || "",
    company: apiCompany.company || "",
    brand: apiCompany.brand || "",
    statusImpozit: apiCompany.status || "activ",
    adresa: location[0] || "",
    localitate: (location[0] || "").replace(/, Romania$/, ""),
    website: website[0] || "",
    _fromPeviitor: true,
  };
}

async function lookupCompany(companyName) {
  const upper = companyName.toUpperCase().trim();
  if (companyCache[upper] !== undefined) return companyCache[upper];

  try {
    const matches = await searchCompanyByName(companyName);
    if (matches && matches.length) {
      const best = matches.find(m => (m.company || "").toUpperCase().trim() === upper) || matches[0];
      const info = normalizePeviitorCompany(best);
      if (info.cif) {
        companyCache[upper] = info;
        return info;
      }
    }
  } catch {}

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

async function fetchJobsPage(page) {
  const url = `${API_BASE}/?page_size=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": "job_seeker_ro_spider" } });
  if (res.status === 404 || res.status === 400) return [];
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (data.detail === "Invalid page.") return [];
  return data.results || data;
}

async function uploadJobsBatch(jobs) {
  for (let i = 0; i < jobs.length; i += UPLOAD_BATCH) {
    const chunk = jobs.slice(i, i + UPLOAD_BATCH);
    const r = await upsertJobs(chunk);
    console.log(`  → ${chunk.length} jobs upserted via API (${i + chunk.length}/${jobs.length})`);
  }
}

async function run() {
  console.log("=== inviitor.ro → peviitor (job core via API v1) ===");
  let totalNew = 0;
  const seenUrls = new Set();
  const newJobs = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const jobs = await fetchJobsPage(page);
    if (!jobs.length) {
      console.log(`Page ${page}: no jobs → done`);
      break;
    }

    const fresh = [];
    for (const job of jobs) {
      const url = job.job_link || "";
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      fresh.push(job);
    }

    console.log(`Page ${page}: ${jobs.length} jobs (${fresh.length} new this page)`);

    if (!fresh.length) continue;

    const uniqueCompanies = [...new Set(fresh.map(j => (j.company_name || "").trim().toUpperCase()).filter(Boolean))];
    const companyInfos = await Promise.all(uniqueCompanies.map(async name => {
      const info = await lookupCompany(name);
      return { name, info };
    }));
    const companyMap = {};
    for (const ci of companyInfos) {
      companyMap[ci.name] = ci.info;
    }

    for (const ci of companyInfos) {
      if (!ci.info || ci.info._fromPeviitor) continue;
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
        console.log(`✅ Company "${companyDoc.company}" upserted via API.`);
      } catch (e) {
        console.log(`  ⚠️ Nu am putut upserta compania ${ci.name}: ${e.message}`);
      }
    }

    const jobDocs = fresh.map(job => {
      const rawName = (job.company_name || "").trim().toUpperCase();
      const record = buildJobRecord(job, companyMap[rawName]);
      if (record.title.length > 200) record.title = record.title.slice(0, 200);
      return record;
    });

    newJobs.push(...jobDocs);
    totalNew += jobDocs.length;

    if (newJobs.length >= UPLOAD_BATCH) {
      const toUpload = newJobs.splice(0, UPLOAD_BATCH);
      await uploadJobsBatch(toUpload);
    }

    if (MAX_TOTAL_JOBS > 0 && totalNew >= MAX_TOTAL_JOBS) {
      console.log(`Reached limit of ${MAX_TOTAL_JOBS} new jobs, stopping.`);
      break;
    }
  }

  if (newJobs.length) await uploadJobsBatch(newJobs);

  console.log("\n=== Done ===");
  console.log(`New jobs collected: ${totalNew}`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import fetch from "node-fetch";
import { writeFileSync, mkdirSync } from "fs";
import { searchCompanyByName, upsertCompany, upsertJobs } from "./api.js";
import { searchAndGetBestMatch } from "./anaf.js";
import { buildCompanyRecord } from "./company-builder.js";
import { buildJobRecord } from "./job-builder.js";
import { findWebsite } from "./web-search.js";
import { generateNotFoundReport, generateNotFoundJson } from "./not-found-report.js";
import { extractHostname, classifyPlatform, generatePlatformReport, generatePlatformJson } from "./platform-report.js";

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
  const notFoundByCompany = {};
  const platforms = new Map();

  function trackPlatform(url) {
    const host = extractHostname(url);
    if (!host) return;
    const existing = platforms.get(host);
    if (existing) {
      existing.count += 1;
    } else {
      const cls = classifyPlatform(host);
      platforms.set(host, { host, count: 1, url, type: cls.type, name: cls.name });
    }
  }

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
      trackPlatform(url);
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

    for (const job of fresh) {
      const rawName = (job.company_name || "").trim().toUpperCase();
      const companyInfo = companyMap[rawName];

      if (!companyInfo || !companyInfo.cif) {
        if (!notFoundByCompany[rawName]) notFoundByCompany[rawName] = [];
        notFoundByCompany[rawName].push({
          url: job.job_link || "",
          title: job.job_title || job.title || "",
          city: job.city || "",
        });
        continue;
      }

      const record = buildJobRecord(job, companyInfo, rawName);
      if (record.title.length > 200) record.title = record.title.slice(0, 200);
      newJobs.push(record);
      totalNew++;
    }

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

  const notFoundCount = Object.values(notFoundByCompany).reduce((sum, jobs) => sum + jobs.length, 0);
  console.log(`\nCompanies not found: ${Object.keys(notFoundByCompany).length}`);
  console.log(`Jobs skipped (company not found): ${notFoundCount}`);

  try {
    const report = generateNotFoundReport(notFoundByCompany);
    mkdirSync("docs", { recursive: true });
    writeFileSync("docs/companii-negasite.md", report, "utf-8");
    writeFileSync("docs/companii-negasite.json", JSON.stringify(generateNotFoundJson(notFoundByCompany), null, 2), "utf-8");
    console.log("Saved docs/companii-negasite.md + docs/companii-negasite.json");
  } catch (e) {
    console.log(`⚠️ Nu am putut scrie raportul: ${e.message}`);
  }

  const aggregatorCount = [...platforms.values()].filter(p => p.type === "aggregator").length;
  console.log(`\nPlatforms found: ${platforms.size} (${aggregatorCount} aggregator portals)`);

  try {
    const platformReport = generatePlatformReport(platforms);
    writeFileSync("docs/platforme.md", platformReport, "utf-8");
    writeFileSync("docs/platforme.json", JSON.stringify(generatePlatformJson(platforms), null, 2), "utf-8");
    console.log("Saved docs/platforme.md + docs/platforme.json");
  } catch (e) {
    console.log(`⚠️ Nu am putut scrie raportul de platforme: ${e.message}`);
  }

  console.log("\n=== Done ===");
  console.log(`New jobs collected: ${totalNew}`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

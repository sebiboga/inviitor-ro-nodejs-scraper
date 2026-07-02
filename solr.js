/**
 * Solr Database Module
 * 
 * PURPOSE: Provides interface to Solr database for storing and retrieving
 * job listings and company data. Solr is used as the primary data store
 * for the peviitor.ro job aggregation system.
 * 
 * This module handles:
 * - Querying jobs by company CIF
 * - Querying company data
 * - Adding/updating (upserting) jobs
 * 
 * Solr Cores:
 * - job: Stores individual job listings
 * - company: Stores company metadata
 */

import fetch from "node-fetch";
import fs from "fs";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // .env.local may not exist in CI — SOLR_AUTH comes from GitHub Secrets
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Solr core URLs
const SOLR_URL = "https://solr.peviitor.ro/solr/job";        // Job listings core
const SOLR_COMPANY_URL = "https://solr.peviitor.ro/solr/company"; // Company core

// HTTP request timeout in milliseconds
const TIMEOUT = 10000;

/**
 * Returns the SOLR_AUTH credential string ("user:password") from the environment,
 * throwing if it is missing. All SOLR operations in this module use this helper
 * so the error message stays consistent.
 *
 * @returns {string} The SOLR_AUTH credential string
 * @throws {Error} If SOLR_AUTH is not set
 */
export function getSolrAuth() {
  const auth = process.env.SOLR_AUTH;
  if (!auth) throw new Error("SOLR_AUTH not set in environment");
  return auth;
}

// ============================================================================
// JOB OPERATIONS - Query, Add, Update
// ============================================================================

/**
 * Queries jobs from Solr by company CIF
 * @param {string} cif - Company CIF/CUI to search for
 * @returns {Promise<Object>} - Solr response with numFound and docs array
 */
export async function querySOLR(cif) {
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({
    q: `cif:${cif}`,  // Query by CIF field
    rows: 100,        // Limit results
    wt: "json"        // Return JSON format
  });

  const res = await fetch(`${SOLR_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

// ============================================================================
// COMPANY OPERATIONS - Query and Upsert company data in Solr
// ============================================================================

/**
 * Checks if a job URL already exists in Solr job core.
 * @param {string} url - Job URL to check
 * @returns {Promise<boolean>} true if the URL already exists
 */
export async function jobUrlExists(url) {
  const AUTH = getSolrAuth();
  const q = `url:"${url.replace(/"/g, '\\"')}"`;
  const params = new URLSearchParams({ q, rows: 0, wt: "json" });
  const res = await fetch(`${SOLR_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.response?.numFound || 0) > 0;
}

/**
 * Searches for a company in Solr company core by name.
 * Returns normalized data matching the shape from anaf.js normalizeCompany(),
 * or null if not found.
 * @param {string} brandName - Company name to search for
 * @returns {Promise<Object|null>} Normalized company data with _solrGroup
 */
export async function findCompanyInSolr(brandName) {
  const AUTH = getSolrAuth();
  const q = `company:"${brandName.replace(/"/g, '\\"')}"`;
  const params = new URLSearchParams({ q, rows: 5, wt: "json" });
  const res = await fetch(`${SOLR_COMPANY_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const docs = data.response?.docs || [];
  if (!docs.length) return null;

  const upper = brandName.toUpperCase().trim();
  let best = null, bestScore = -1;
  for (const doc of docs) {
    const name = (doc.company || "").toUpperCase().trim();
    let score = 0;
    if (name === upper) score = 100;
    else if (name.includes(upper) || upper.includes(name)) score = 50;
    else continue;
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  if (!best) return null;

  const cif = Array.isArray(best.cif) ? best.cif[0] : (best.cif || 0);
  const website = Array.isArray(best.website) ? best.website[0] : (best.website || "");
  const address = Array.isArray(best.address) ? best.address[0] : (best.address || "");
  const locationArr = Array.isArray(best.location) ? best.location : [];

  let anafParsed = null;
  try {
    if (best.anafData && best.anafData.length) {
      anafParsed = JSON.parse(best.anafData[0]);
    }
  } catch {}

  return {
    cif,
    cui: cif,
    denumire: best.company || brandName,
    company: best.company || brandName,
    brand: best.brand || brandName.toUpperCase().trim(),
    statusImpozit: best.status || "activ",
    adresa: address,
    localitate: locationArr.length ? locationArr[0].replace(/, Romania$/, "") : "",
    website,
    _solrGroup: best.group || "",
    _anafParsed: anafParsed,
  };
}

/**
 * Upserts (adds or updates) a company document to the SOLR company core
 * @param {Object} companyDoc - Company document with id, company, brand, status, location, etc.
 */
export async function upsertCompany(companyDoc) {
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  const res = await fetch(`${SOLR_COMPANY_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: JSON.stringify([companyDoc])
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Company "${companyDoc.company}" upserted to SOLR company core.`);
}

// ============================================================================

/**
 * Queries company data from Solr company core
 * @param {string} companyQuery - Solr query string (e.g., "company:EPAM*" or "id:33159615")
 * @returns {Promise<Object>} - Solr response with company docs
 */
export async function queryCompanySOLR(companyQuery) {
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({
    q: companyQuery,
    rows: 10,
    wt: "json"
  });

  const res = await fetch(`${SOLR_COMPANY_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

// ============================================================================
// UPSERT OPERATIONS - Add or update jobs
// ============================================================================

/**
 * Upserts (adds or updates) jobs to Solr
 * Jobs are matched by URL - if URL exists, job is updated; otherwise, new job is added
 * @param {Array} jobs - Array of job objects to upsert
 */
export async function upsertJobs(jobs) {
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  const body = JSON.stringify(jobs);

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Upserted ${jobs.length} jobs to SOLR.`);
}

// ============================================================================
// EXTRACT WORKFLOW - Backup jobs before scraping
// ============================================================================

/**
 * Extracts current jobs from Solr and saves to backup file
 * Used before scraping to preserve existing job data
 * @param {string} cif - Company CIF
 */
async function runExtract(cif) {
  console.log("=== Extract existing jobs from SOLR ===\n");

  try {
    const result = await querySOLR(cif);
    console.log(`Found ${result.numFound} existing jobs in SOLR for CIF ${cif}`);

    if (result.numFound === 0) {
      console.log("No existing jobs to backup.");
      return;
    }

    // Save backup
    const backup = {
      extractedAt: new Date().toISOString(),
      cif: cif,
      count: result.numFound,
      jobs: result.docs
    };

    fs.writeFileSync("tmp/jobs_existing.json", JSON.stringify(backup, null, 2), "utf-8");
    console.log("\n✅ Saved existing jobs to tmp/jobs_existing.json\n");
  } catch (err) {
    console.error("Failed to extract existing jobs:", err.message);
    process.exit(1);
  }
}

// ============================================================================
// COMPANY QUERY WORKFLOW - Query company core
// ============================================================================

/**
 * Queries companies from Solr company core
 * Useful for debugging and verification
 * @param {Array} args - Command line arguments
 */
async function runCompanyQuery(args) {
  console.log("=== Query Company in SOLR ===\n");
  
  const query = args[1] || "company:EPAM*";
  console.log(`Query: ${query}`);
  
  const result = await queryCompanySOLR(query);
  console.log(`Found ${result.numFound} companies`);
  
  if (result.docs?.length) {
    console.log("\nFirst company:");
    console.log(JSON.stringify(result.docs[0], null, 2));
  }
}

// ============================================================================
// GENERIC UPSERT - Upsert documents to any Solr core by name
// ============================================================================

const CORES = {
  job: SOLR_URL,
  company: SOLR_COMPANY_URL,
};

export async function upsertSolrDocs(core, docs) {
  const AUTH = getSolrAuth();
  const coreUrl = CORES[core];
  if (!coreUrl) throw new Error(`Unknown Solr core: ${core}`);

  const params = new URLSearchParams({ commit: "true", overwrite: "true" });

  const res = await fetch(`${coreUrl}/update/json/docs?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: JSON.stringify(docs)
  });

  const body = await res.text();
  return { status: res.status, statusText: res.statusText, body };
}

// ============================================================================
// STANDALONE MODE - Run solr.js directly for maintenance tasks
// ============================================================================

/**
 * Usage:
 *   node solr.js extract <CIF>      - Extract jobs to backup file
 *   node solr.js company            - Query companies
 */
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("solr.js")) {
  const args = process.argv.slice(2);
  
  if (args.includes("extract")) {
    const cif = args[1] || null;
    if (!cif) {
      console.error("Error: CIF required. Usage: node solr.js extract <CIF>");
      process.exit(1);
    }
    await runExtract(cif);
  } else if (args.includes("company")) {
    await runCompanyQuery(args);
  } else {
    console.log("Usage: node solr.js extract <CIF> | company");
  }
}

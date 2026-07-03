import fetch from "node-fetch";
import { searchAndGetBestMatchFallback } from "./anaf-fallback.js";

const ANAF_API_URL = "https://demoanaf.ro/api/company/";
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;
const FETCH_TIMEOUT = 5000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCompany(raw, brandName) {
  const upper = (brandName || raw.name || raw.denumire || "").toUpperCase().trim();
  const cif = parseInt(raw.cif || raw.cui) || 0;
  return {
    cif,
    cui: cif,
    denumire: raw.denumire || raw.name || raw.company || brandName || "",
    company: raw.denumire || raw.name || raw.company || brandName || "",
    brand: upper,
    statusImpozit: raw.statusImpozit || raw.status || raw.statusLabel || "activ",
    adresa: raw.adresa || raw.address || "",
    localitate: raw.localitate || raw.locality || raw.headquartersAddress?.locality || "",
    website: raw.website || "",
  };
}

export async function getCompanyFromANAF(cif) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${ANAF_API_URL}${cif}`;
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "job_seeker_ro_spider" }
      });
      if (!res.ok) {
        lastError = new Error(`ANAF API error: ${res.status}`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      const json = await res.json();
      if (json.success === false) {
        lastError = new Error(json.error?.message || "ANAF returned error");
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      return json.data ? normalizeCompany(json.data) : null;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError || new Error("ANAF API failed after retries");
}

export async function searchCompany(brandName) {
  const url = `${ANAF_SEARCH_URL}?q=${encodeURIComponent(brandName)}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "job_seeker_ro_spider" }
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map(c => normalizeCompany(c));
  } catch { return []; }
}

export async function searchAndGetBestMatch(brandName) {
  let results;
  let fromDemoanaf = true;

  try {
    results = await searchCompany(brandName);
  } catch {
    results = null;
  }

  if (!results || !results.length) {
    try {
      const fb = await searchAndGetBestMatchFallback(brandName);
      if (fb) return fb;
    } catch {}
    fromDemoanaf = false;
  }

  if (!results || !results.length) {
    return null;
  }

  const upper = brandName.toUpperCase().trim();
  let match = null;
  let bestScore = -1;

  for (const c of results) {
    const name = (c.denumire || c.company || "").toUpperCase().trim();
    let score = 0;
    if (name === upper) {
      score = 100;
    } else if (name.includes(upper) || upper.includes(name)) {
      score = 50 + Math.min(name.length, upper.length) / Math.max(name.length, upper.length) * 50;
    } else {
      const words = upper.split(/\s+/);
      const matchCount = words.filter(w => name.includes(w)).length;
      score = (matchCount / words.length) * 50;
    }
    // company that hires is active → strong preference
    const status = (c.statusImpozit || c.status || c.statusLabel || "").toLowerCase();
    const isInactive = status === "inactiv" || status.startsWith("inactiv") || status === "dissolved" || status.startsWith("dissolv") || status === "radiat" || status.startsWith("radiat");
    if (isInactive) score -= 100;
    if (score > bestScore) {
      bestScore = score;
      match = c;
    }
  }

  if (!match) return null;

  if (fromDemoanaf) {
    try {
      const detail = await getCompanyFromANAF(match.cui);
      if (detail) return detail;
    } catch {}
  }

  return match;
}

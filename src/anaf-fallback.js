import fetch from "node-fetch";
import fs from "fs";

const API_URL = "https://cinesunt.on-forge.com/api";
const CACHE_FILE = "data/anaf-cache.json";

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); } catch { return {}; }
}

function saveCache(cache) {
  try {
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

export async function searchAndGetBestMatchFallback(brandName) {
  const cache = loadCache();
  const upper = brandName.toUpperCase().trim();

  if (cache[upper]) {
    return cache[upper];
  }

  const queries = [brandName];
  // try without S.C. prefix
  const noSC = brandName.replace(/^S\.?\s*C\.?\s*/i, "").trim();
  if (noSC !== brandName) queries.push(noSC);
  // try without legal suffix (SRL, S.R.L., SA, S.A.)
  const stripped = (noSC !== brandName ? noSC : brandName).replace(/[.\s]*(S\.?R\.?L\.?|S\.?A\.?)\s*$/i, "").trim();
  if (stripped && stripped !== brandName && stripped !== noSC) queries.push(stripped);
  // try just the first 2-3 words
  const words = (stripped || brandName).split(/\s+/).filter(Boolean);
  if (words.length > 3) queries.push(words.slice(0, 3).join(" "));
  if (words.length > 2) queries.push(words.slice(0, 2).join(" "));

  let results = [];
  for (const q of queries) {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "job_seeker_ro_spider" }
    });
    if (!res.ok) continue;
    const data = await res.json();
    results = data.results || [];
    if (results.length) break;
  }

  if (!results.length) return null;

  // prefer active companies among exact matches, then any active
  const exact = results.filter(r => r.is_exact_match);
  const active = results.filter(r => r.is_active);
  const match = exact.find(r => r.is_active) || active[0] || results[0];
  const cif = parseInt(match.cui) || 0;

  const result = {
    cif,
    cui: cif,
    denumire: match.name || match.display_name || brandName,
    company: match.name || match.display_name || brandName,
    brand: upper,
    statusImpozit: match.is_active ? "activ" : "inactiv",
    adresa: match.location || "",
    localitate: match.locality || "",
    website: "",
  };

  cache[upper] = result;
  saveCache(cache);

  return result;
}

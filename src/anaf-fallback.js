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

  const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(brandName)}`, {
    headers: { "User-Agent": "job_seeker_ro_spider" }
  });
  if (!res.ok) return null;

  const data = await res.json();
  const results = data.results || [];
  if (!results.length) return null;

  const match = results.find(r => r.is_exact_match) || results[0];
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

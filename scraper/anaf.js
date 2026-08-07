import fetch from "node-fetch";

const ANAF_API_URL = "https://demoanaf.ro/api/company/";
const ANAF_SEARCH_URL = "https://demoanaf.ro/api/search";
const CUISCAN_API_URL = "https://cuiscan.ro/api.php";
const CUIFIRMA_SEARCH_URL = "https://cuifirma.ro/api/search";
const TIMEOUT_MS = 10000;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "job_seeker_ro_spider" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalizeCompany(raw, brandName) {
  const upper = (brandName || raw.name || raw.denumire || "").toUpperCase().trim();
  const cif = parseInt(raw.cif || raw.cui || raw.id) || 0;
  return {
    cif,
    cui: cif,
    denumire: raw.denumire || raw.name || raw.company || brandName || "",
    company: raw.denumire || raw.name || raw.company || brandName || "",
    brand: upper,
    statusImpozit: raw.statusImpozit || raw.status || raw.statusLabel || "activ",
    adresa: raw.adresa || raw.address || raw.location || "",
    localitate: raw.localitate || raw.locality || raw.headquartersAddress?.locality || "",
    website: raw.website || "",
  };
}

export async function getCompanyFromANAF(cif) {
  try {
    const json = await fetchJson(`${ANAF_API_URL}${cif}`);
    if (json.success === false) throw new Error(json.error?.message || "ANAF error");
    return json.data ? normalizeCompany(json.data) : null;
  } catch (err) {
    const json = await fetchJson(`${CUISCAN_API_URL}?action=company&cui=${cif}`);
    if (!json || !json.denumire) throw new Error("CUIScan returned no data");
    return normalizeCompany(json);
  }
}

export async function searchCompany(brandName) {
  try {
    const json = await fetchJson(`${ANAF_SEARCH_URL}?q=${encodeURIComponent(brandName)}`);
    return (json.data || []).map(c => normalizeCompany(c, brandName));
  } catch {
    const json = await fetchJson(`${CUIFIRMA_SEARCH_URL}?q=${encodeURIComponent(brandName)}`);
    return (json.results || []).map(r => normalizeCompany({
      cui: r.cui,
      name: r.name,
      status: r.is_active ? "activ" : "inactiv"
    }, brandName));
  }
}

export async function searchAndGetBestMatch(brandName) {
  const upper = brandName.toUpperCase().trim();
  let results;
  try {
    results = await searchCompany(brandName);
  } catch {
    results = [];
  }
  if (!results || !results.length) return null;

  let match = null;
  let bestScore = -1;
  for (const c of results) {
    const name = (c.denumire || c.company || "").toUpperCase().trim();
    let score = 0;
    if (name === upper) score = 100;
    else if (name.includes(upper) || upper.includes(name)) {
      score = 50 + Math.min(name.length, upper.length) / Math.max(name.length, upper.length) * 50;
    } else {
      const words = upper.split(/\s+/);
      const matchCount = words.filter(w => name.includes(w)).length;
      score = (matchCount / words.length) * 50;
    }
    const status = (c.statusImpozit || c.status || "").toLowerCase();
    if (status === "inactiv" || status.startsWith("inactiv") || status.startsWith("radiat")) score -= 100;
    if (score > bestScore) {
      bestScore = score;
      match = c;
    }
  }
  return match;
}

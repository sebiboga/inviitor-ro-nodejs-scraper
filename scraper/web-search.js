import fetch from "node-fetch";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT = 5000;

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanBrand(brandName) {
  return brandName.replace(/[.\s]*(S\.?R\.?L\.?|S\.?A\.?|PFA|PF)\s*$/i, "").trim().toLowerCase();
}

async function tryDuckDuckGo(companyName) {
  const query = `${companyName} site oficial`.slice(0, 200);
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return "";
    const html = await res.text();
    const match = html.match(/class="result__url"[^>]*>([^<]+)</);
    if (!match) return "";
    let domain = match[1].trim();
    if (!domain.startsWith("http")) domain = "https://" + domain;
    return domain;
  } catch { return ""; }
}

async function tryPatterns(brandName) {
  const brand = cleanBrand(brandName).replace(/[^a-z0-9]/g, "");
  if (!brand) return "";
  const patterns = [
    `https://www.${brand}.ro`,
    `https://${brand}.ro`,
    `https://www.${brand}.com`,
    `https://${brand}.com`,
    `https://www.${brand}.eu`,
    `https://${brand}.eu`,
  ];
  for (const url of patterns) {
    try {
      const res = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": UA } });
      if (res.status >= 200 && res.status < 400) return url;
    } catch {}
  }
  return "";
}

export async function findWebsite(companyName, brandName) {
  const ddg = await tryDuckDuckGo(companyName);
  if (ddg) return ddg;
  return tryPatterns(brandName);
}

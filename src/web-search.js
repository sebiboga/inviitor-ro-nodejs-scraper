import fetch from "node-fetch";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function findWebsite(companyName, brandName) {
  const query = `${companyName} site oficial`.slice(0, 200);
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return "";

  const html = await res.text();
  const match = html.match(/class="result__url"[^>]*>([^<]+)</);
  if (!match) return "";

  let domain = match[1].trim();
  if (!domain.startsWith("http")) domain = "https://" + domain;
  return domain;
}

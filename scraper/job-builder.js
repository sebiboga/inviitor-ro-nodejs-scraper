const DIACRITICS_MAP = {
  ă: "a", â: "a", î: "i", ș: "s", ț: "t",
  Ă: "A", Â: "A", Î: "I", Ș: "S", Ț: "T",
};

function removeDiacritics(s) {
  return s.replace(/[ăâîșțĂÂÎȘȚ]/g, ch => DIACRITICS_MAP[ch] || ch);
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

export function buildJobRecord(apiJob, anafData, brandName) {
  const anaf = anafData || {};
  const cif = anaf.cif || anaf.cui || "";
  const companyName = (anaf.denumire || anaf.company || brandName || "").toUpperCase().trim();

  const title = (apiJob.job_title || apiJob.title || apiJob.name || "").trim() || "Unknown Position";
  const cityRaw = (apiJob.city || "").trim() || "";
  const city = cityRaw.replace(/,?\s*Romania\s*$/i, "").trim();
  const location = city ? [`${city}, Romania`] : ["Romania"];

  const remoteVal = (apiJob.remote || apiJob.workmode || "").trim() || "";
  let workmode = "on-site";
  const rl = remoteVal.toLowerCase();
  if (rl.includes("remote") || rl.includes("hybrid")) {
    workmode = rl.includes("hybrid") ? "hybrid" : "remote";
  }

  const salaryParts = [];
  if (apiJob.salary_min) salaryParts.push(apiJob.salary_min);
  if (apiJob.salary_max) salaryParts.push(apiJob.salary_max);
  let salary = "";
  if (salaryParts.length) {
    salary = `${salaryParts.join("-")} ${apiJob.salary_currency || "RON"}`;
  } else {
    salary = apiJob.salary || "";
  }

  const job = {
    url: apiJob.job_link || apiJob.url || "",
    title: title.slice(0, 200),
    company: companyName,
    cif: String(cif),
    location,
    tags: extractTags(title, companyName),
    workmode,
    date: new Date().toISOString(),
    status: "scraped",
    source: "inviitor.ro"
  };
  if (salary) job.salary = salary;

  return job;
}

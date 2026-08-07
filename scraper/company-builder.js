export function buildCompanyRecord(anafData, brandName, extra = {}) {
  const now = new Date().toISOString().split("T")[0];
  const cif = String(anafData.cif || anafData.cui || 0);
  const companyName = anafData.denumire || anafData.company || brandName;
  const brand = brandName.toUpperCase().trim();
  const localitate = anafData.localitate || anafData.city || "";
  const website = anafData.website || "";

  return {
    id: cif,
    company: companyName.toUpperCase().trim(),
    brand: brand,
    status: (anafData.statusImpozit || anafData.status || "activ").toLowerCase(),
    location: localitate ? [localitate] : ["Romania"],
    website: website ? [website] : [],
    career: extra.careerUrls || [],
    group: extra.group || "",
    lastScraped: now,
    scraperFile: extra.scraperFile || "https://raw.githubusercontent.com/sebiboga/inviitor-ro-nodejs-scraper/main/.github/workflows/job-seeker-ro-spider.yml",
  };
}

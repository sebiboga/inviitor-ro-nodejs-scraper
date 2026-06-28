export function buildCompanyRecord(anafData, brandName, extra = {}) {
  const now = new Date().toISOString().split("T")[0];
  const cif = anafData.cif || anafData.cui || 0;
  const companyName = anafData.denumire || anafData.company || brandName;
  const brand = brandName.toUpperCase().trim();
  const localitate = anafData.localitate || anafData.city || "";
  const address = anafData.adresa || anafData.address || "";
  const website = anafData.website || "";

  return {
    id: `company-${cif}`,
    company: companyName,
    cif: cif,
    brand: brand,
    status: (anafData.statusImpozit || anafData.status || "activ").toLowerCase(),
    location: localitate ? [localitate] : ["Romania"],
    website: website ? [website] : [],
    career: extra.careerUrls || [],
    group: extra.group || "",
    lastScraped: now,
    scraperFile: extra.scraperFile || "inviitor-ro-nodejs-scraper",
    address: address,
    anafData: JSON.stringify(anafData),
    existingJobsCount: extra.jobCount || 0,
  };
}

export function buildJobRecord(apiJob, anafData, brandName) {
  const cif = anafData.cif || anafData.cui || 0;
  const companyName = anafData.denumire || anafData.company || brandName;
  const brand = brandName.toUpperCase().trim();

  const title = (apiJob.job_title || apiJob.title || apiJob.name || "").trim() || "Unknown Position";
  const cityRaw = (apiJob.city || "").trim() || "";
  const city = cityRaw.replace(/,?\s*Romania\s*$/i, "").trim();
  const location = city ? `${city}, Romania` : "Romania";
  const county = apiJob.county || apiJob.judet || "";
  const remoteVal = (apiJob.remote || apiJob.workmode || "").trim() || "";

  const salaryParts = [];
  if (apiJob.salary_min) salaryParts.push(`de la ${apiJob.salary_min}`);
  if (apiJob.salary_max) salaryParts.push(`până la ${apiJob.salary_max}`);
  if (salaryParts.length) salaryParts.push(`${apiJob.salary_currency || "RON"}/lună`);
  const salary = salaryParts.length ? salaryParts.join(" ") : (apiJob.salary || "");

  const jobLink = apiJob.job_link || apiJob.url || "";
  const jobDate = apiJob.date || apiJob.created_at || apiJob.posted_date || "";
  const dateStr = jobDate ? jobDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const raw = `${cif}-${title}-${city}`;
  const idB64 = Buffer.from(raw).toString("base64").replace(/[+/=]/g, "").slice(0, 30);

  let workmode = "on-site";
  const rl = remoteVal.toLowerCase();
  if (rl.includes("remote") || rl.includes("hybrid")) {
    workmode = rl.includes("hybrid") ? "hybrid" : "remote";
  }

  return {
    id: `job-${cif}-${idB64}`,
    url: jobLink,
    title: title,
    job_title: title,
    company: companyName,
    company_name: brandName,
    cif: String(cif),
    location: location,
    city: city,
    country: "Romania",
    county: county,
    workmode: workmode,
    workplaceType: remoteVal || "on-site",
    status: "activ",
    salary: salary,
    remote: remoteVal,
    date: `${dateStr}T00:00:00Z`,
    vdate: `${dateStr}T00:00:00Z`,
    expirationdate: "",
    created_at: `${dateStr}T00:00:00Z`,
    postingDate: `${dateStr}T00:00:00Z`,
    published: `${dateStr}T00:00:00Z`,
    tags: [brand.toLowerCase(), "inviitor.ro"],
    source: "inviitor.ro",
  };
}

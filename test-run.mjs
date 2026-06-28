import fetch from "node-fetch";

// ============================================================
// 1. FETCH 10 JOBS FROM inviitor.ro API
// ============================================================
console.log("=== 1. Fetching 10 jobs from inviitor.ro API ===");
const API = "https://api.laurentiumarian.ro/mobile/?page_size=10&page=1";
const res = await fetch(API);
const data = await res.json();

const jobs = data.results || data;
console.log(`Fetched ${jobs.length} jobs`);

// Distinct companies
const companies = [...new Set(jobs.map(j => j.company_name).filter(Boolean))];
console.log(`Distinct companies: ${companies.join(", ")}`);

// ============================================================
// 2. ANAF LOOKUP per company
// ============================================================
console.log("\n=== 2. ANAF Lookup ===");
const anafResults = {};
for (const name of companies) {
  console.log(`\n--- ${name} ---`);
  try {
    // Search by brand/name
    const searchRes = await fetch(
      `https://demoanaf.ro/api/search?q=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "job_seeker_ro_spider" } }
    );
    if (!searchRes.ok) {
      console.log(`  ANAF search failed: ${searchRes.status}`);
      anafResults[name] = null;
      continue;
    }
    const searchData = await searchRes.json();
    if (!searchData.success || !searchData.data?.length) {
      console.log(`  No ANAF results for "${name}"`);
      anafResults[name] = null;
      continue;
    }
    
    // Find exact or closest match
    const upper = name.toUpperCase();
    let match = searchData.data.find(c => 
      c.denumire?.toUpperCase() === upper || 
      c.denumire?.toUpperCase().includes(upper) ||
      upper.includes(c.denumire?.toUpperCase())
    );
    if (!match) match = searchData.data[0];
    
    console.log(`  Match: ${match.denumire} (CIF ${match.cui})`);
    
    // Get company details
    const detailRes = await fetch(
      `https://demoanaf.ro/api/company/${match.cui}`,
      { headers: { "User-Agent": "job_seeker_ro_spider" } }
    );
    const detailData = await detailRes.json();
    
    if (detailData.success && detailData.data) {
      const c = detailData.data;
      anafResults[name] = {
        cif: parseInt(c.cif || match.cui),
        company: c.denumire || match.denumire,
        status: c.statusImpozit || "activ",
        address: c.adresa || "",
        brand: name.toUpperCase(),
        group: "inviitor.ro",
        lastScraped: new Date().toISOString().split("T")[0],
        scraperFile: "inviitor-ro-nodejs-scraper",
        website: c.website ? [c.website] : [],
        career: [],
        location: c.localitate ? [c.localitate] : ["Romania"],        
      };
      console.log(`  ✅ ANAF data: ${anafResults[name].company} (${anafResults[name].cif})`);
    } else {
      anafResults[name] = null;
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    anafResults[name] = null;
  }
}

// ============================================================
// 3. BUILD COMPANY + JOB RECORDS (production schema)
// ============================================================
console.log("\n=== 3. Building Solr records ===");

const companiesToUpsert = [];
const jobsToUpsert = [];

for (const job of jobs) {
  const anaf = anafResults[job.company_name];
  if (!anaf) {
    console.log(`  ⏭️ Skipping job from ${job.company_name} (no ANAF data)`);
    continue;
  }
  
  // Build company record
  const companyRecord = {
    id: `company-${anaf.cif}`,
    company: anaf.company,
    cif: anaf.cif,
    brand: anaf.brand,
    status: anaf.status,
    location: anaf.location,
    website: anaf.website,
    career: anaf.career,
    group: anaf.group,
    lastScraped: anaf.lastScraped,
    scraperFile: anaf.scraperFile,
    address: anaf.address,
    anafData: JSON.stringify(anaf),
    existingJobsCount: 0,
  };
  companiesToUpsert.push(companyRecord);
  
  // Build job record
  const jobTitle = job.job_title?.trim() || job.title?.trim() || job.name?.trim() || "Unknown Position";
  const city = job.city?.trim() || "";
  const location = city ? `${city}, Romania` : "Romania";
  const remote = job.remote?.trim() || "";
  const salary = job.salary_min && job.salary_max 
    ? `${job.salary_min} - ${job.salary_max} ${job.salary_currency || "RON"}/lună`
    : job.salary_min 
      ? `de la ${job.salary_min} ${job.salary_currency || "RON"}/lună`
      : "";
  const jobDate = job.date || job.created_at || job.posted_date || "";
  const dateStr = jobDate ? jobDate.split("T")[0] : new Date().toISOString().split("T")[0];
  
  const jobRecord = {
    id: `job-${anaf.cif}-${Buffer.from(job.job_link || job.url || jobTitle).toString("base64").slice(0, 20)}`,
    url: job.job_link || job.url || "",
    title: jobTitle,
    job_title: jobTitle,
    company: anaf.company,
    company_name: job.company_name,
    cif: String(anaf.cif),
    location: location,
    city: city,
    country: "Romania",
    county: "",
    workmode: remote.toLowerCase().includes("remote") ? "remote" : (remote.toLowerCase().includes("hybrid") ? "hybrid" : "on-site"),
    workplaceType: remote || "on-site",
    status: "activ",
    salary: salary,
    remote: remote,
    date: `${dateStr}T00:00:00Z`,
    vdate: `${dateStr}T00:00:00Z`,
    expirationdate: "",
    created_at: `${dateStr}T00:00:00Z`,
    postingDate: `${dateStr}T00:00:00Z`,
    published: `${dateStr}T00:00:00Z`,
    tags: [anaf.brand, "inviitor.ro"],
    source: "inviitor.ro",
  };
  jobsToUpsert.push(jobRecord);
}

console.log(`  Companies to upsert: ${companiesToUpsert.length}`);
console.log(`  Jobs to upsert: ${jobsToUpsert.length}`);

// ============================================================
// 4. UPSERT TO PRODUCTION SOLR
// ============================================================
console.log("\n=== 4. Upserting to solr.peviitor.ro ===");

const SOLR_AUTH = "solr:SolrRocks";
const B64 = Buffer.from(SOLR_AUTH).toString("base64");
const HEADERS = {
  "Authorization": `Basic ${B64}`,
  "Content-Type": "application/json",
  "User-Agent": "job_seeker_ro_spider"
};

// De-duplicate companies by id
const seen = new Set();
const uniqueCompanies = companiesToUpsert.filter(c => {
  if (seen.has(c.id)) return false;
  seen.add(c.id);
  return true;
});

// Upsert companies
if (uniqueCompanies.length) {
  const companyBody = JSON.stringify(uniqueCompanies);
  const compRes = await fetch(
    "https://solr.peviitor.ro/solr/company/update/json/docs?commit=true&overwrite=true",
    { method: "POST", headers: HEADERS, body: companyBody }
  );
  console.log(`  Company upsert: ${compRes.status} ${compRes.statusText}`);
  const compText = await compRes.text();
  console.log(`  Response: ${compText}`);
}

// Upsert jobs
if (jobsToUpsert.length) {
  const jobBody = JSON.stringify(jobsToUpsert);
  const jobRes = await fetch(
    "https://solr.peviitor.ro/solr/job/update/json/docs?commit=true&overwrite=true",
    { method: "POST", headers: HEADERS, body: jobBody }
  );
  console.log(`  Job upsert: ${jobRes.status} ${jobRes.statusText}`);
  const jobText = await jobRes.text();
  console.log(`  Response: ${jobText}`);
}

// ============================================================
// 5. VERIFY
// ============================================================
console.log("\n=== 5. Verification ===");

// Query jobs
for (const job of jobsToUpsert.slice(0, 3)) {
  const verifyRes = await fetch(
    `https://solr.peviitor.ro/solr/job/select?q=id:${encodeURIComponent(job.id)}&wt=json`,
    { headers: HEADERS }
  );
  const verifyData = await verifyRes.json();
  const numFound = verifyData.response?.numFound || 0;
  console.log(`  Job "${job.title?.slice(0, 40)}": ${numFound > 0 ? "✅ found" : "❌ not found"}`);
}

// Query companies
for (const co of uniqueCompanies) {
  const verifyRes = await fetch(
    `https://solr.peviitor.ro/solr/company/select?q=id:${encodeURIComponent(co.id)}&wt=json`,
    { headers: HEADERS }
  );
  const verifyData = await verifyRes.json();
  const numFound = verifyData.response?.numFound || 0;
  console.log(`  Company "${co.company}": ${numFound > 0 ? "✅ found" : "❌ not found"}`);
}

console.log("\n=== Done ===");

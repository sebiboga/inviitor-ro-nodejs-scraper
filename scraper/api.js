import fetch from "node-fetch";

const API_BASE_URL = "https://api.peviitor.ro/v1";
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function padCif(cif) {
  return String(cif || "").padStart(8, "0");
}

async function request(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "User-Agent": "job_seeker_ro_spider", ...(options.headers || {}) }
      });
      if (res.ok || res.status === 404) return res;
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(500 * attempt);
    }
  }
}

export async function searchCompanyByName(name) {
  const res = await request(`${API_BASE_URL}/firme/company/?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  return (data && data.data) || [];
}

export async function upsertCompany(companyDoc) {
  const res = await request(`${API_BASE_URL}/firme/company/add/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...companyDoc, id: padCif(companyDoc.id) })
  });
  const data = await res.json().catch(() => ({}));
  if (data.success === false) throw new Error(JSON.stringify(data));
}

export async function upsertJobs(jobs) {
  const res = await request(`${API_BASE_URL}/scraper/jobs/upload/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobs.map(job => ({ ...job, cif: padCif(job.cif) })))
  });
  const data = await res.json().catch(() => ({}));
  if (data.success === false) throw new Error(JSON.stringify(data));
  return data;
}

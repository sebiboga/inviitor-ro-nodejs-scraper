export function generateNotFoundJson(notFoundByCompany, { generatedAt } = {}) {
  const names = Object.keys(notFoundByCompany).sort();
  const totalJobs = Object.values(notFoundByCompany).reduce((sum, jobs) => sum + jobs.length, 0);

  return {
    generatedAt: (generatedAt || new Date()).toISOString(),
    totalCompanies: names.length,
    totalJobs,
    companies: names.map((name, idx) => ({
      name,
      jobCount: notFoundByCompany[name].length,
      jobs: notFoundByCompany[name].map(job => ({
        title: job.title || "",
        city: job.city || "",
        url: job.url || "",
      })),
    })),
  };
}

export function generateNotFoundReport(notFoundByCompany, { generatedAt } = {}) {
  const names = Object.keys(notFoundByCompany).sort();
  const totalJobs = Object.values(notFoundByCompany).reduce((sum, jobs) => sum + jobs.length, 0);
  const dateStr = (generatedAt || new Date()).toISOString();

  const lines = [];
  lines.push("# Companii negăsite");
  lines.push("");
  lines.push(`Raport generat la: ${dateStr}`);
  lines.push("");
  lines.push(`Total companii negăsite: **${names.length}**`);
  lines.push("");
  lines.push(`Total job-uri afectate: **${totalJobs}**`);
  lines.push("");
  lines.push("## Lista companiilor");
  lines.push("");
  lines.push("| # | Companie | Job-uri |");
  lines.push("|---|----------|---------|");
  names.forEach((name, idx) => {
    lines.push(`| ${idx + 1} | ${escapeTable(name)} | ${notFoundByCompany[name].length} |`);
  });
  lines.push("");
  lines.push("## Detalii job-uri");
  lines.push("");

  for (const name of names) {
    lines.push(`### ${name}`);
    lines.push("");
    const jobs = notFoundByCompany[name];
    if (jobs.length === 0) {
      lines.push("_Niciun job._");
    } else {
      lines.push("| # | Titlu | Oraș | URL |");
      lines.push("|---|-------|------|-----|");
      jobs.forEach((job, idx) => {
        lines.push(`| ${idx + 1} | ${escapeTable(job.title || "-")} | ${escapeTable(job.city || "-")} | ${job.url ? `[link](${job.url})` : "-"} |`);
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeTable(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

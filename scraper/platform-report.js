const ATS_PLATFORMS = {
  "workday.com": "Workday",
  "myworkdayjobs.com": "Workday",
  "workdays.com": "Workday",
  "wd3.myworkdayjobs.com": "Workday",
  "teamtailor.com": "Teamtailor",
  "smartrecruiters.com": "SmartRecruiters",
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "bamboohr.com": "BambooHR",
  "bamboohr.co.uk": "BambooHR",
  "recruitee.com": "Recruitee",
  "workable.com": "Workable",
  "icims.com": "iCIMS",
  "successfactors.com": "SAP SuccessFactors",
  "oraclecloud.com": "Oracle Cloud (OIC)",
  "jobs.net": "Jobs.net",
  "jobadder.com": "JobAdder",
  "bullhorn.com": "Bullhorn",
  "jobvite.com": "Jobvite",
  "softgarden.com": "Softgarden",
  "taleo.net": "Oracle Taleo",
  "oracle.com": "Oracle",
  "adp.com": "ADP",
  "peopleforce.io": "PeopleForce",
  "recruit.com": "Recruit",
  "hrmarketer.com": "HR Marketer",
  "interviewstream.com": "InterviewStream",
  "candidate.greenhouse.io": "Greenhouse",
  "boards.greenhouse.io": "Greenhouse",
  "app.teamtailor.com": "Teamtailor"
};

export function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchMap(hostname, map) {
  if (map[hostname]) return map[hostname];
  const key = Object.keys(map).find(k => hostname.endsWith("." + k));
  return key ? map[key] : null;
}

export function classifyPlatform(hostname) {
  const ats = matchMap(hostname, ATS_PLATFORMS);
  if (ats) return { type: "ats", name: ats };
  return { type: "company", name: hostname };
}

export function finalizePlatform(entry) {
  const ats = matchMap(entry.host, ATS_PLATFORMS);
  const distinctCompanies = entry.companies instanceof Set ? entry.companies.size : (entry.companyCount || 0);

  if (ats) {
    entry.type = "ats";
    entry.name = ats;
  } else if (distinctCompanies >= 2) {
    entry.type = "aggregator";
    entry.name = entry.host;
  } else {
    entry.type = "company";
    entry.name = entry.host;
  }
  entry.companyCount = distinctCompanies;
  delete entry.companies;
  return entry;
}

export function generatePlatformJson(platforms, { generatedAt } = {}) {
  const dateStr = (generatedAt || new Date()).toISOString();
  const entries = [...platforms.values()]
    .map(e => ({ ...e }))
    .sort((a, b) => b.count - a.count);

  const aggregators = entries.filter(e => e.type === "aggregator");
  const ats = entries.filter(e => e.type === "ats");
  const company = entries.filter(e => e.type === "company");

  return {
    generatedAt: dateStr,
    totalDomains: entries.length,
    counts: {
      aggregators: aggregators.length,
      ats: ats.length,
      companies: company.length,
    },
    aggregators,
    ats,
    companies: company,
  };
}

export function generatePlatformReport(platforms, { generatedAt } = {}) {
  const dateStr = (generatedAt || new Date()).toISOString();
  const entries = [...platforms.values()].sort((a, b) => b.count - a.count);

  const aggregators = entries.filter(e => e.type === "aggregator");
  const ats = entries.filter(e => e.type === "ats");
  const company = entries.filter(e => e.type === "company");

  const lines = [];
  lines.push("# Platforme sursă — inviitor.ro");
  lines.push("");
  lines.push(`Raport generat la: ${dateStr}`);
  lines.push("");
  lines.push(`Total domenii distincte: **${entries.length}**`);
  lines.push("");
  lines.push(`- **Agregatoare** (portale de joburi): ${aggregators.length}`);
  lines.push(`- **Platforme ATS/cariere**: ${ats.length}`);
  lines.push(`- **Site-uri companii**: ${company.length}`);
  lines.push("");
  lines.push("## Agregatoare (portale de joburi)");
  lines.push("");
  if (!aggregators.length) {
    lines.push("_Niciun agregator detectat._");
  } else {
    lines.push("| Platformă | Domeniu | Job-uri | Exemplu URL |");
    lines.push("|-----------|---------|---------|-------------|");
    for (const e of aggregators) {
      lines.push(`| ${e.name} | \`${e.host}\` | ${e.count} | [link](${e.url}) |`);
    }
  }
  lines.push("");
  lines.push("## Platforme ATS/cariere");
  lines.push("");
  if (!ats.length) {
    lines.push("_Nicio platformă ATS detectată._");
  } else {
    lines.push("| Platformă | Domeniu | Job-uri | Exemplu URL |");
    lines.push("|-----------|---------|---------|-------------|");
    for (const e of ats) {
      lines.push(`| ${e.name} | \`${e.host}\` | ${e.count} | [link](${e.url}) |`);
    }
  }
  lines.push("");
  lines.push("## Site-uri companii");
  lines.push("");
  if (!company.length) {
    lines.push("_Niciun site de companie detectat._");
  } else {
    lines.push("| Domeniu | Job-uri | Exemplu URL |");
    lines.push("|---------|---------|-------------|");
    for (const e of company) {
      lines.push(`| \`${e.host}\` | ${e.count} | [link](${e.url}) |`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

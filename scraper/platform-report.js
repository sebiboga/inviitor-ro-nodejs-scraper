const AGGREGATORS = {
  "ejobs.ro": "eJobs.ro",
  "ejobs.md": "eJobs.md",
  "bestjobs.ro": "BestJobs.ro",
  "bestjobs.eu": "BestJobs.eu",
  "hipo.ro": "Hipo.ro",
  "careerjet.ro": "CareerJet.ro",
  "careerjet.com": "CareerJet.com",
  "jobviewtrack.com": "CareerJet (tracking)",
  "jobradar.ro": "JobRadar.ro",
  "jobzz.ro": "Jobzz.ro",
  "e-jobs.ro": "e-jobs.ro",
  "joburile.ro": "Joburile.ro",
  "joburi.ro": "Joburi.ro",
  "jobs.md": "Jobs.md",
  "salarium.com": "Salarium",
  "jobsora.com": "Jobsora",
  "jobsora.ro": "Jobsora.ro",
  "jobmesa.ro": "JobMesa.ro",
  "jooble.org": "Jooble",
  "jooble.ro": "Jooble.ro",
  "indeed.com": "Indeed",
  "indeed.ro": "Indeed.ro",
  "glassdoor.com": "Glassdoor",
  "linkedin.com": "LinkedIn Jobs",
  "stepstone.ro": "StepStone.ro",
  "adzuna.ro": "Adzuna.ro",
  "adzuna.com": "Adzuna",
  "jobtome.com": "Jobtome",
  "jobisite.com": "Jobisite",
  "jobg8.com": "JobG8",
  "jobadx.com": "JobAdx",
  "talenttraders.com": "TalentTraders",
  "myjob.ro": "MyJob.ro",
  "stagiipebune.ro": "StagiiPeBune.ro",
  "instajob.ro": "InstaJob.ro",
  "job.ro": "Job.ro",
  "recruiter.ro": "Recruiter.ro",
  "joblist.ro": "JobList.ro",
  "jobboom.ro": "JobBoom.ro",
  "jobfix.ro": "JobFix.ro",
  "lucru.ro": "Lucru.ro",
  "taleo.net": "Oracle Taleo (ATS aggregator)"
};

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
  "smartrecruiters.com": "SmartRecruiters",
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

export function classifyPlatform(hostname) {
  if (AGGREGATORS[hostname]) return { type: "aggregator", name: AGGREGATORS[hostname] };
  if (ATS_PLATFORMS[hostname]) return { type: "ats", name: ATS_PLATFORMS[hostname] };
  return { type: "company", name: hostname };
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

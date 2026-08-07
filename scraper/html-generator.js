import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DOCS_DIR = join(process.cwd(), "docs");

function readJson(name) {
  try {
    return JSON.parse(readFileSync(join(DOCS_DIR, name), "utf-8"));
  } catch {
    return null;
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function link(url) {
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">link</a>` : "—";
}

function table(head, rows) {
  return `<table class="table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

function platformRows(items, withName) {
  return items.map((item, i) => {
    const name = withName ? `<td>${esc(item.name || item.host)}</td>` : "";
    return `<tr><td>${i + 1}</td>${name}<td class="domain">${esc(item.host)}</td><td class="num">${item.count}</td><td>${link(item.url)}</td></tr>`;
  }).join("");
}

export function generateHtml({ platforms, notFound } = {}) {
  const p = platforms || readJson("platforme.json");
  const nf = notFound || readJson("companii-negasite.json");

  if (!p || !nf) {
    throw new Error("platforme.json sau companii-negasite.json lipsesc");
  }

  const genAt = p.generatedAt ? new Date(p.generatedAt) : new Date();
  const dateStr = genAt.toLocaleDateString("ro-RO");
  const timeStr = genAt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  const aggregators = table(
    ["#", "Platformă", "Domeniu", "Job-uri", "Exemplu URL"],
    platformRows(p.aggregators || [], true)
  );

  const atsTable = p.ats && p.ats.length
    ? table(["#", "Platformă", "Domeniu", "Job-uri", "Exemplu URL"], platformRows(p.ats, true))
    : '<div class="empty">Nicio platformă ATS detectată.</div>';

  const companies = table(
    ["#", "Domeniu", "Job-uri", "Exemplu URL"],
    platformRows(p.companies || [], false)
  );

  const nfTable = table(
    ["#", "Companie", "Job-uri"],
    (nf.companies || []).map((c, i) =>
      `<tr><td>${i + 1}</td><td class="company-name">${esc(c.name)}</td><td class="num">${c.jobCount}</td></tr>`
    ).join("")
  );

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Locuri de muncă — inviitor.ro</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fdf6f0; color: #2d2a24; line-height: 1.6; padding: 2rem 1rem; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { color: #c44536; font-size: 1.5rem; margin-bottom: .25rem; }
    .sub { color: #7d6b5a; font-size: .9rem; margin-bottom: 1.5rem; }
    .card { background: #fffcf9; border-radius: 16px; box-shadow: 0 4px 24px rgba(90,60,40,.10); overflow: hidden; margin-bottom: 1.25rem; }
    .card-header { padding: 1rem 1.5rem; border-bottom: 1px solid #f0e4d8; font-weight: 600; color: #5a4a3a; display: flex; justify-content: space-between; align-items: center; }
    .badge { font-size: .75rem; padding: .2rem .6rem; border-radius: 12px; font-weight: 600; }
    .b-green { background: #e8f5ec; color: #2e7d32; }
    .b-blue { background: #e8f0fe; color: #1a56db; }
    .b-red { background: #fdecec; color: #c44536; }
    .card-body { padding: 1.5rem; }
    .stats { display: flex; flex-wrap: wrap; gap: .75rem; }
    .stat { background: #f0faf3; border-radius: 12px; padding: 1rem; text-align: center; flex: 1; min-width: 140px; }
    .stat b { display: block; font-size: 1.5rem; color: #2e7d32; }
    .stat span { font-size: .8rem; color: #558b5a; }
    .table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .table th { text-align: left; padding: .55rem .75rem; color: #7d6b5a; font-size: .75rem; text-transform: uppercase; border-bottom: 1px solid #f0e4d8; }
    .table td { padding: .55rem .75rem; border-bottom: 1px solid #f5ede6; vertical-align: top; }
    .table a { color: #c44536; text-decoration: none; font-weight: 500; }
    .num { text-align: right; font-weight: 600; color: #2e7d32; white-space: nowrap; }
    .domain { font-family: monospace; font-size: .8rem; color: #5a4a3a; }
    .company-name { font-weight: 600; color: #c44536; }
    .summary { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .summary strong { color: #c44536; }
    .empty { color: #9a8a7a; font-size: .9rem; }
    .btn-wrapper { text-align: center; margin: 1rem 0; }
    .btn { display: inline-flex; align-items: center; gap: .5rem; background: #c44536; color: #fff; text-decoration: none; padding: .8rem 1.6rem; border-radius: 10px; font-weight: 600; font-size: .9rem; margin: .25rem; }
    .btn:hover { background: #a83828; }
    .btn-green { background: #4a7c59; }
    .btn-green:hover { background: #3d6848; }
    .btn-red { background: #c44536; }
    .btn-red:hover { background: #a83828; }
    footer { text-align: center; padding: 2rem 0; color: #9a8a7a; font-size: .8rem; }
    footer a { color: #c44536; text-decoration: none; }
  </style>
</head>
<body>
<div class="container">
  <h1>Locuri de muncă — inviitor.ro</h1>
  <p class="sub">Scraper automat multi-companie pentru job-urile de pe inviitor.ro</p>

  <div class="card"><div class="card-body">
    <div class="stats">
      <div class="stat"><b>${p.counts?.aggregators ?? p.aggregators?.length ?? 0}</b><span>Agregatori</span></div>
      <div class="stat"><b>${p.counts?.ats ?? p.ats?.length ?? 0}</b><span>Platforme ATS</span></div>
      <div class="stat"><b>${p.counts?.companies ?? p.companies?.length ?? 0}</b><span>Site-uri companii</span></div>
      <div class="stat"><b>${p.totalDomains}</b><span>Domenii distincte</span></div>
      <div class="stat"><b>${dateStr} ${timeStr}</b><span>Raport generat la</span></div>
    </div>
  </div></div>

  <div class="card">
    <div class="card-header"><span>Agregatori (portale de job-uri)</span><span class="badge b-green">${p.aggregators?.length ?? 0}</span></div>
    <div class="card-body">${aggregators}</div>
  </div>

  <div class="card">
    <div class="card-header"><span>Platforme ATS/cariere</span><span class="badge b-blue">${p.ats?.length ?? 0}</span></div>
    <div class="card-body">${atsTable}</div>
  </div>

  <div class="card">
    <div class="card-header"><span>Site-uri companii</span><span class="badge b-blue">${p.companies?.length ?? 0}</span></div>
    <div class="card-body">${companies}</div>
  </div>

  <div class="card">
    <div class="card-header"><span>Companii negăsite</span><span class="badge b-red">${nf.totalCompanies}</span></div>
    <div class="card-body">
      <div class="summary">
        <div><strong>Total companii negăsite:</strong> ${nf.totalCompanies}</div>
        <div><strong>Total job-uri afectate:</strong> ${nf.totalJobs}</div>
      </div>
      ${nfTable}
    </div>
  </div>

  <div class="btn-wrapper">
    <a class="btn" href="test-results/index.html" target="_blank"><span>&#10004;</span> Testare</a>
    <a class="btn btn-green" href="platforme.md" target="_blank"><span>&#128196;</span> Raport platforme (MD)</a>
    <a class="btn btn-red" href="companii-negasite.md" target="_blank"><span>&#128203;</span> Companii negăsite (MD)</a>
  </div>

  <footer>
    <a href="https://github.com/sebiboga/inviitor-ro-nodejs-scraper" target="_blank">GitHub</a> &middot;
    <a href="https://peviitor.ro/" target="_blank">peviitor.ro</a>
  </footer>
</div>
</body>
</html>
`;
}

export function generateHtmlFile() {
  writeFileSync(join(DOCS_DIR, "index.html"), generateHtml(), "utf-8");
  console.log("Saved docs/index.html");
}

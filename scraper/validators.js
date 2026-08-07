const URL_REGEX = /^https?:\/\/.+/;

export function validateCompanyRecord(record) {
  const errors = [];

  if (!record.id) errors.push("missing id");
  if (!record.company) errors.push("missing company");
  if (!record.cif && record.cif !== 0) errors.push("missing cif");
  if (!record.brand) errors.push("missing brand");
  if (record.brand && record.brand !== record.brand.toUpperCase()) errors.push("brand not uppercase");

  if (record.website && Array.isArray(record.website)) {
    record.website.forEach((u, i) => {
      if (u && !URL_REGEX.test(u)) errors.push(`website[${i}] invalid URL: ${u}`);
    });
  }

  if (record.career && Array.isArray(record.career)) {
    record.career.forEach((u, i) => {
      if (u && !URL_REGEX.test(u)) errors.push(`career[${i}] invalid URL: ${u}`);
    });
  }

  if (record.lastScraped && !/^\d{4}-\d{2}-\d{2}$/.test(record.lastScraped)) {
    errors.push(`lastScraped invalid format: ${record.lastScraped}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateJobRecord(record) {
  const errors = [];

  if (!record.id) errors.push("missing id");
  if (!record.url) errors.push("missing url");
  if (record.url && !URL_REGEX.test(record.url)) errors.push("invalid url");

  if (!record.title) errors.push("missing title");
  if (record.title && record.title.length > 200) errors.push("title too long (>200)");

  if (!record.cif && record.cif !== "0") errors.push("missing cif");

  if (record.workmode && !["remote", "on-site", "hybrid"].includes(record.workmode)) {
    errors.push(`invalid workmode: ${record.workmode}`);
  }

  if (record.tags && Array.isArray(record.tags)) {
    record.tags.forEach((t, i) => {
      if (t !== t.toLowerCase()) errors.push(`tag[${i}] not lowercase: ${t}`);
    });
    if (record.tags.length > 20) errors.push("too many tags (>20)");
  }

  if (record.date && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(record.date)) {
    errors.push(`date invalid format: ${record.date}`);
  }

  return { valid: errors.length === 0, errors };
}

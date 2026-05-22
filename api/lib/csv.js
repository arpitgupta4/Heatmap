// ─── CSV Parsing Utilities ─────────────────────────────────────────────────────

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { values.push(current); current = ''; continue; }
    current += ch;
  }
  values.push(current);
  return values.map((v) => v.trim());
}

function parseCsvRows(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
}

function parseCsvToObjects(text) {
  const rows = parseCsvRows(text);
  const headers = rows[0] || [];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h || `col_${i}`] = row[i] ?? ''; });
    return obj;
  });
}

function parseNumber(value) {
  const n = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

module.exports = { parseCsvLine, parseCsvRows, parseCsvToObjects, parseNumber };

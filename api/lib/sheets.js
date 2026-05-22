// ─── Sheet Parsers ─────────────────────────────────────────────────────────────
const { parseCsvRows, parseNumber } = require('./csv');
const { normalizeRadarRow }         = require('./normalize');

// Parse the full radar sheet — stocks from A-I, summary from K-L
function parseRadarSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { stocks: [], summary: {}, error: false };
  const headers = rows[0];

  if (headers[0] === '#VALUE!' || headers[0] === '#N/A' || headers[0] === '#ERROR!') {
    return { stocks: [], summary: {}, error: true };
  }

  // Extract summary key-value pairs from columns K (10) and L (11)
  const sm = {};
  if (headers[10]) sm[headers[10]] = (headers[11] || '').trim();
  for (let i = 1; i <= 5 && i < rows.length; i++) {
    const k = (rows[i]?.[10] || '').trim();
    const v = (rows[i]?.[11] || '').trim();
    if (k) sm[k] = v;
  }

  // Build stock objects from columns 0-8
  const stocks = rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i <= 8 && i < headers.length; i++) {
      obj[headers[i] || `col_${i}`] = (row[i] || '').trim();
    }
    return normalizeRadarRow(obj);
  }).filter((r) => r.symbol);

  return {
    stocks,
    summary: {
      totalStocks: parseInt(sm['Total Stocks']) || stocks.length,
      pctChange:   parseFloat(String(sm['%Change']).replace('%', '')) || 0,
      advance:     parseInt(sm['Advance'])  || 0,
      decliners:   parseInt(sm['Decliners']) || 0,
      sentiment:   sm['Market Sentiment'] || 'Neutral',
    },
    error: false,
  };
}

// Parse Results sheet — cols A-E for results, today's date from K column
function parseResultsSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { items: [], today: '' };
  const headers = rows[0];

  let todayStr = '';
  const tdIdx = headers.findIndex(h => /today/i.test(h));
  if (tdIdx >= 0) {
    todayStr = (headers[tdIdx + 1] || '').trim();
    if (!todayStr && rows[1]) todayStr = (rows[1][tdIdx] || '').trim();
  }

  const items = rows.slice(1)
    .filter(row => (row[0] || '').trim() && (row[4] || '').trim())
    .map(row => ({
      symbol:  (row[0] || '').trim(),
      company: (row[1] || '').trim(),
      purpose: (row[2] || '').trim(),
      details: (row[3] || '').trim(),
      date:    (row[4] || '').trim(),
    }));

  return { items, today: todayStr };
}

// Parse heatmap sheet into typed change items
function buildHeatmapItems(text) {
  const rows = parseCsvRows(text);
  const header = rows[0] || [];
  const sections = [];

  for (let i = 0; i < header.length; i++) {
    const label = header[i]?.trim();
    const next  = header[i + 1]?.trim();
    if (!label || !next) continue;
    if (/change/i.test(next)) {
      sections.push({ nameIndex: i, changeIndex: i + 1, type: label });
      i++;
    }
  }

  return rows.slice(1).flatMap((row) =>
    sections.map((s) => {
      const name = row[s.nameIndex] || '';
      const val  = parseNumber(row[s.changeIndex] || '');
      return name ? { type: s.type, name, dailyChange: val } : null;
    })
  ).filter(Boolean);
}

module.exports = { parseRadarSheet, parseResultsSheet, buildHeatmapItems };

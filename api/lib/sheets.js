// ─── Sheet Parsers ─────────────────────────────────────────────────────────────
const { parseCsvRows, parseNumber } = require('./csv');
const { normalizeRadarRow }         = require('./normalize');

/**
 * Parse the radar sheet.
 *
 * Old approach: read pre-computed summary from Google Sheets formula cells
 * in columns K/L (fragile — any formula error killed the whole tab).
 *
 * New approach: parse only the stock rows (cols 0–N) and compute every
 * summary metric here in JS. Columns K/L are completely ignored so
 * #VALUE! / #N/A errors in the sheet never surface to the user.
 */
function parseRadarSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { stocks: [], summary: computeRadarSummary([]), error: false };

  const headers = rows[0];

  // Detect formula errors propagated into the very first header cell
  const FORMULA_ERRORS = new Set(['#VALUE!', '#N/A', '#ERROR!', '#REF!', '#NAME?', '#NUM!', '#NULL!']);
  if (FORMULA_ERRORS.has((headers[0] || '').trim())) {
    return { stocks: [], summary: computeRadarSummary([]), error: true };
  }

  // Find the last meaningful column (stop before any formula-error columns)
  // We look for a column whose header is clearly a formula error and stop there.
  let lastCol = headers.length;
  for (let i = 0; i < headers.length; i++) {
    if (FORMULA_ERRORS.has((headers[i] || '').trim())) { lastCol = i; break; }
  }

  // Build normalised stock objects from clean columns only
  const stocks = rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < lastCol; i++) {
      const key = (headers[i] || '').trim() || `col_${i}`;
      obj[key] = (row[i] || '').trim();
    }
    return normalizeRadarRow(obj);
  }).filter((r) => r.symbol);

  return {
    stocks,
    summary: computeRadarSummary(stocks),
    error: false,
  };
}

/**
 * Derive all summary numbers purely from the stock array.
 * No Google Sheets formulas involved — always consistent with the data.
 */
function computeRadarSummary(stocks) {
  const total     = stocks.length;
  const advance   = stocks.filter((s) => s.pctChange > 0).length;
  const decliners = stocks.filter((s) => s.pctChange < 0).length;
  const avgChange = total
    ? stocks.reduce((sum, s) => sum + s.pctChange, 0) / total
    : 0;

  const pctAdvancing = total ? Math.round((advance / total) * 100) : 50;
  let sentiment;
  if      (pctAdvancing >= 60) sentiment = 'Bullish';
  else if (pctAdvancing <= 40) sentiment = 'Bearish';
  else                         sentiment = 'Neutral';

  return { totalStocks: total, pctChange: avgChange, advance, decliners, sentiment };
}

// ─── Results sheet ─────────────────────────────────────────────────────────────
// Parse Results sheet — cols A–E for results, today's date from a "Today" header cell
function parseResultsSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { items: [], today: '' };
  const headers = rows[0];

  let todayStr = '';
  const tdIdx = headers.findIndex((h) => /today/i.test(h));
  if (tdIdx >= 0) {
    todayStr = (headers[tdIdx + 1] || '').trim();
    if (!todayStr && rows[1]) todayStr = (rows[1][tdIdx] || '').trim();
  }

  const items = rows.slice(1)
    .filter((row) => (row[0] || '').trim() && (row[4] || '').trim())
    .map((row) => ({
      symbol:  (row[0] || '').trim(),
      company: (row[1] || '').trim(),
      purpose: (row[2] || '').trim(),
      details: (row[3] || '').trim(),
      date:    (row[4] || '').trim(),
    }));

  return { items, today: todayStr };
}

// ─── Heatmap sheet ─────────────────────────────────────────────────────────────
// Parse heatmap sheet into typed change items
function buildHeatmapItems(text) {
  const rows   = parseCsvRows(text);
  const header = rows[0] || [];
  const sections = [];

  for (let i = 0; i < header.length; i++) {
    const label = (header[i]   || '').trim();
    const next  = (header[i+1] || '').trim();
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

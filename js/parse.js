/* ============================================================
   PARSE — frontend CSV parsing (fallback for local dev when
   /api/data is unavailable). Mirrors the logic in api/lib/.
   ============================================================ */
function _parseCsvLine(line) {
  const values = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { values.push(current); current = ''; continue; }
    current += ch;
  }
  values.push(current);
  return values.map((v) => v.trim());
}

function _parseCsvRows(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map(_parseCsvLine);
}

function _parseNumber(value) {
  const n = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function _normalizeRadarRow(row) {
  return {
    symbol:    (row['Symbol']    || '').trim(),
    high:      _parseNumber(row['High']       || 0),
    prevClose: _parseNumber(row['Prev Close'] || 0),
    ltp:       _parseNumber(row['LTP']        || 0),
    change:    _parseNumber(row['Change']     || 0),
    pctChange: _parseNumber(row['%Change']    || 0),
    marketCap: _parseNumber(row['MarketCap']  || 0),
  };
}

function _normalizeStockRow(row) {
  return {
    securityId:  row['Security Id'] || '',
    // 'Theme' is the new column name; 'Parent Theme' is the old name (kept for backward compat)
    parentTheme: row['Theme'] || row['Parent Theme'] || '',
    // 'Sector' is the new column name; 'Sector Name' is the old name (kept for backward compat)
    sectorName:  row['Sector'] || row['Sector Name'] || '',
    industry:    row['Industry'] || '',
    // 'Daily Change' = absolute Δ (col E), '%Change' = percentage Δ (col F)
    dailyChange: _parseNumber(row['%Change'] || row['% Change'] || ''),
    change:      _parseNumber(row['Daily Change'] || row['Change'] || 0),
    ltp: 0,
  };
}

function _parseCsvToObjects(text) {
  const rows = _parseCsvRows(text);
  const headers = rows[0] || [];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h || `col_${i}`] = row[i] ?? ''; });
    return obj;
  });
}

function _buildHeatmapItems(text) {
  const rows = _parseCsvRows(text);
  const header = rows[0] || [];
  const sections = [];
  for (let i = 0; i < header.length; i++) {
    const label = header[i]?.trim(), next = header[i + 1]?.trim();
    if (!label || !next) continue;
    if (/change/i.test(next)) { sections.push({ nameIndex: i, changeIndex: i + 1, type: label }); i++; }
  }
  return rows.slice(1).flatMap((row) =>
    sections.map((s) => {
      const name = row[s.nameIndex] || '';
      const val  = _parseNumber(row[s.changeIndex] || '');
      return name ? { type: s.type, name, dailyChange: val } : null;
    })
  ).filter(Boolean);
}

/**
 * Compute radar summary purely from the stock array.
 * Mirrors computeRadarSummary() in api/lib/sheets.js — no Google Sheets
 * formula columns involved.
 */
function _computeRadarSummary(stocks) {
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

/**
 * Parse the radar CSV.
 * New logic: reads only stock-data columns, ignores cols K/L formula values,
 * and computes all summary metrics locally — matching the server-side rewrite
 * in api/lib/sheets.js so local-dev and production behave identically.
 */
function _parseRadarSheet(csvText) {
  const rows = _parseCsvRows(csvText);
  if (rows.length < 2) return { stocks: [], summary: _computeRadarSummary([]), error: false };

  const headers = rows[0];
  const FORMULA_ERRORS = new Set(['#VALUE!', '#N/A', '#ERROR!', '#REF!', '#NAME?', '#NUM!', '#NULL!']);

  if (FORMULA_ERRORS.has((headers[0] || '').trim())) {
    return { stocks: [], summary: _computeRadarSummary([]), error: true };
  }

  // Stop at the first formula-error column to avoid reading corrupt cells
  let lastCol = headers.length;
  for (let i = 0; i < headers.length; i++) {
    if (FORMULA_ERRORS.has((headers[i] || '').trim())) { lastCol = i; break; }
  }

  const stocks = rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < lastCol; i++) {
      const key = (headers[i] || '').trim() || `col_${i}`;
      obj[key] = (row[i] || '').trim();
    }
    return _normalizeRadarRow(obj);
  }).filter((r) => r.symbol);

  return {
    stocks,
    summary: _computeRadarSummary(stocks),
    error: false,
  };
}

function _parseResultsSheet(csvText) {
  const rows = _parseCsvRows(csvText);
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

// Fetch directly from Google Sheets (fallback for local dev without vercel dev)
async function _fetchFromSheets() {
  const [stocksRes, heatmapRes, radarRes, resultsRes] = await Promise.all([
    fetch(_STOCKS_CSV),
    fetch(_HEATMAP_CSV),
    fetch(_RADAR_CSV),
    fetch(_RESULTS_CSV),
  ]);
  if (!stocksRes.ok || !heatmapRes.ok || !radarRes.ok || !resultsRes.ok) {
    throw new Error('Sheet fetch failed');
  }
  const [stocksCsv, heatmapCsv, radarCsv, resultsCsv] = await Promise.all([
    stocksRes.text(), heatmapRes.text(), radarRes.text(), resultsRes.text(),
  ]);
  const radarSheet   = _parseRadarSheet(radarCsv);
  const resultsSheet = _parseResultsSheet(resultsCsv);
  return {
    stocks:       _parseCsvToObjects(stocksCsv).map(_normalizeStockRow),
    heatmap:      _buildHeatmapItems(heatmapCsv),
    radar:        radarSheet.stocks,
    radarSummary: radarSheet.summary,
    radarError:   radarSheet.error,
    results:      resultsSheet.items,
    resultsToday: resultsSheet.today,
  };
}

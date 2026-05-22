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
    securityId:  row['Security Id'] || row['Name'] || '',
    name:        row['Sector Name'] || row['Name'] || row['Security Id'] || '',
    industry:    row['Industry New Name'] || row['Industry'] || '',
    group:       row['Igroup Name'] || row['Group'] || '',
    subgroup:    row['ISubgroup Name'] || row['Subgroup'] || '',
    dailyChange: _parseNumber(
      row['%Change'] || row['Daily Chang'] || row['Daily Change'] ||
      row['% Change'] || row['Daily %change'] || ''
    ),
    change: _parseNumber(row['Daily Change'] || row['Change'] || 0),
    ltp:    _parseNumber(row['LTP'] || row['Close'] || row['Last Price'] || 0),
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

function _parseRadarSheet(csvText) {
  const rows = _parseCsvRows(csvText);
  if (rows.length < 2) return { stocks: [], summary: {}, error: false };
  const headers = rows[0];

  if (headers[0] === '#VALUE!' || headers[0] === '#N/A' || headers[0] === '#ERROR!') {
    return { stocks: [], summary: {}, error: true };
  }

  const sm = {};
  if (headers[10]) sm[headers[10]] = (headers[11] || '').trim();
  for (let i = 1; i <= 5 && i < rows.length; i++) {
    const k = (rows[i]?.[10] || '').trim();
    const v = (rows[i]?.[11] || '').trim();
    if (k) sm[k] = v;
  }

  const stocks = rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i <= 8 && i < headers.length; i++) {
      obj[headers[i] || `col_${i}`] = (row[i] || '').trim();
    }
    return _normalizeRadarRow(obj);
  }).filter((r) => r.symbol);

  return {
    stocks,
    summary: {
      totalStocks: parseInt(sm['Total Stocks']) || stocks.length,
      pctChange:   parseFloat(String(sm['%Change']).replace('%', '')) || 0,
      advance:     parseInt(sm['Advance'])   || 0,
      decliners:   parseInt(sm['Decliners']) || 0,
      sentiment:   sm['Market Sentiment'] || 'Neutral',
    },
  };
}

function _parseResultsSheet(csvText) {
  const rows = _parseCsvRows(csvText);
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
    results:      resultsSheet.items,
    resultsToday: resultsSheet.today,
  };
}

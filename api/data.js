/**
 * Vercel Serverless Function — /api/data
 *
 * Fetches both Google Sheets CSVs server-side, parses them into JSON,
 * and returns the result with edge-cache headers.
 *
 * The sheet URLs never reach the client browser.
 *
 * To set up on Vercel:
 *   1. Go to your project → Settings → Environment Variables
 *   2. Add: STOCKS_CSV_URL  = <your stocks sheet CSV URL>
 *   3. Add: HEATMAP_CSV_URL = <your heatmap sheet CSV URL>
 *
 * For local dev (vercel dev), create a .env.local file — see .env.local template.
 */

// ─── Sheet URLs ────────────────────────────────────────────────────────────────
// These are read from Vercel environment variables.
// Fallback values are included so the function works in local dev without setup,
// but you should set real env vars in the Vercel dashboard before deploying.
const STOCKS_CSV_URL =
  process.env.STOCKS_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=0&single=true&output=csv';

const HEATMAP_CSV_URL =
  process.env.HEATMAP_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=1442357326&single=true&output=csv';

const RADAR_CSV_URL =
  process.env.RADAR_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjR79H2FbUkdxllGsK37_U8Q-zAkyYTZcV2yS5IC-gPuOvha1Q-agxqPppXitU6nz-yjODMlYaRDJC/pub?gid=704501126&single=true&output=csv';

const RESULTS_CSV_URL =
  process.env.RESULTS_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjR79H2FbUkdxllGsK37_U8Q-zAkyYTZcV2yS5IC-gPuOvha1Q-agxqPppXitU6nz-yjODMlYaRDJC/pub?gid=1150501903&single=true&output=csv';

// ─── CSV Parsing ───────────────────────────────────────────────────────────────
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

// ─── Data Normalization ────────────────────────────────────────────────────────
function normalizeRadarRow(row) {
  return {
    symbol:    (row['Symbol']    || '').trim(),
    high:      parseNumber(row['High']       || 0),
    prevClose: parseNumber(row['Prev Close'] || 0),
    ltp:       parseNumber(row['LTP']        || 0),
    change:    parseNumber(row['Change']     || 0),
    pctChange: parseNumber(row['%Change']    || 0),
    marketCap: parseNumber(row['MarketCap']  || 0),
  };
}

// Parse the full radar sheet — stocks from A-I, summary from K-L
function parseRadarSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { stocks: [], summary: {} };
  const headers = rows[0];

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
      advance:     parseInt(sm['Advance']) || 0,
      decliners:   parseInt(sm['Decliners']) || 0,
      sentiment:   sm['Market Sentiment'] || 'Neutral',
    },
  };
}

function normalizeStockRow(row) {
  return {
    securityId:  row['Security Id'] || row['Name'] || '',
    name:        row['Sector Name'] || row['Name'] || row['Security Id'] || '',
    industry:    row['Industry New Name'] || row['Industry'] || '',
    group:       row['Igroup Name'] || row['Group'] || '',
    subgroup:    row['ISubgroup Name'] || row['Subgroup'] || '',
    dailyChange: parseNumber(
      row['%Change'] || row['Daily Chang'] || row['Daily Change'] ||
      row['% Change'] || row['Daily %change'] || ''
    ),
    change: parseNumber(row['Daily Change'] || row['Change'] || 0),
    ltp: parseNumber(row['LTP'] || row['Close'] || row['Last Price'] || 0)
  };
}

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

// Parse Results sheet — cols A-E for results, today's date from K column
function parseResultsSheet(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { items: [], today: '' };
  const headers = rows[0];

  // Find "Today's Date" column and get the value from the next column in header
  let todayStr = '';
  const tdIdx = headers.findIndex(h => /today/i.test(h));
  if (tdIdx >= 0) {
    // Value is in the next header column (same row) or first data row same column
    todayStr = (headers[tdIdx + 1] || '').trim();
    if (!todayStr && rows[1]) todayStr = (rows[1][tdIdx] || '').trim();
  }

  // Build results from cols 0-4 (SYMBOL, COMPANY, PURPOSE, DETAILS, DATE)
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

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch both sheets in parallel
    const [stocksRes, heatmapRes, radarRes, resultsRes] = await Promise.all([
      fetch(STOCKS_CSV_URL),
      fetch(HEATMAP_CSV_URL),
      fetch(RADAR_CSV_URL),
      fetch(RESULTS_CSV_URL),
    ]);

    if (!stocksRes.ok)  throw new Error(`Stocks sheet fetch failed: HTTP ${stocksRes.status}`);
    if (!heatmapRes.ok) throw new Error(`Heatmap sheet fetch failed: HTTP ${heatmapRes.status}`);
    if (!radarRes.ok)   throw new Error(`Radar sheet fetch failed: HTTP ${radarRes.status}`);
    if (!resultsRes.ok) throw new Error(`Results sheet fetch failed: HTTP ${resultsRes.status}`);

    const [stocksCsv, heatmapCsv, radarCsv, resultsCsv] = await Promise.all([
      stocksRes.text(),
      heatmapRes.text(),
      radarRes.text(),
      resultsRes.text(),
    ]);

    const stocks  = parseCsvToObjects(stocksCsv).map(normalizeStockRow);
    const heatmap = buildHeatmapItems(heatmapCsv);
    const radarSheet = parseRadarSheet(radarCsv);
    const resultsSheet = parseResultsSheet(resultsCsv);

    // Edge cache for 5 min, serve stale for 10 min while revalidating.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      stocks,
      heatmap,
      radar:        radarSheet.stocks,
      radarSummary: radarSheet.summary,
      results:      resultsSheet.items,
      resultsToday: resultsSheet.today,
      cachedAt: Date.now(),
      counts: { stocks: stocks.length, heatmap: heatmap.length, radar: radarSheet.stocks.length, results: resultsSheet.items.length },
    });
  } catch (err) {
    console.error('[api/data] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch sheet data',
      detail: err.message,
    });
  }
}

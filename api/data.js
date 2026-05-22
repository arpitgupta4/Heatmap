/**
 * Vercel Serverless Function — /api/data
 *
 * Fetches all Google Sheets CSVs server-side, parses them into JSON,
 * and returns the result with edge-cache headers.
 * The sheet URLs never reach the client browser.
 *
 * To set up on Vercel:
 *   1. Go to your project → Settings → Environment Variables
 *   2. Add: STOCKS_CSV_URL  = <your stocks sheet CSV URL>
 *   3. Add: HEATMAP_CSV_URL = <your heatmap sheet CSV URL>
 *   4. Add: RADAR_CSV_URL   = <your radar sheet CSV URL>
 *   5. Add: RESULTS_CSV_URL = <your results sheet CSV URL>
 *
 * For local dev (vercel dev), create a .env.local file — see .env.local template.
 */

const { parseCsvToObjects }                          = require('./lib/csv');
const { normalizeStockRow }                          = require('./lib/normalize');
const { parseRadarSheet, parseResultsSheet, buildHeatmapItems } = require('./lib/sheets');

// ─── Sheet URLs ────────────────────────────────────────────────────────────────
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

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all sheets in parallel, bypassing Vercel's internal fetch cache
    const fetchOpts = { cache: 'no-store' };
    const [stocksRes, heatmapRes, radarRes, resultsRes] = await Promise.all([
      fetch(STOCKS_CSV_URL,  fetchOpts),
      fetch(HEATMAP_CSV_URL, fetchOpts),
      fetch(RADAR_CSV_URL,   fetchOpts),
      fetch(RESULTS_CSV_URL, fetchOpts),
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

    const stocks       = parseCsvToObjects(stocksCsv).map(normalizeStockRow);
    const heatmap      = buildHeatmapItems(heatmapCsv);
    const radarSheet   = parseRadarSheet(radarCsv);
    const resultsSheet = parseResultsSheet(resultsCsv);

    // Edge cache for 5 min, serve stale for 10 min while revalidating.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      stocks,
      heatmap,
      radar:        radarSheet.stocks,
      radarSummary: radarSheet.summary,
      radarError:   radarSheet.error,
      results:      resultsSheet.items,
      resultsToday: resultsSheet.today,
      cachedAt: Date.now(),
      counts: {
        stocks:  stocks.length,
        heatmap: heatmap.length,
        radar:   radarSheet.stocks.length,
        results: resultsSheet.items.length,
      },
    });
  } catch (err) {
    console.error('[api/data] Error:', err.message);
    return res.status(502).json({
      error:  'Failed to fetch sheet data',
      detail: err.message,
    });
  }
}

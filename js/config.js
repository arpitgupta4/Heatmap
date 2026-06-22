/* ============================================================
   CONFIG — constants and sheet URLs (loaded first)
   ============================================================ */
const CACHE_KEY = 'heatmapDataCache_v8';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 250;            // rows rendered per page

// Direct sheet URLs — used ONLY as a local-dev fallback when /api/data
// is not available (e.g. plain Python server). On Vercel the serverless
// function fetches them server-side so these never reach the browser.
const _STOCKS_CSV  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=0&single=true&output=csv';
const _HEATMAP_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=1442357326&single=true&output=csv';
const _RADAR_CSV   = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjR79H2FbUkdxllGsK37_U8Q-zAkyYTZcV2yS5IC-gPuOvha1Q-agxqPppXitU6nz-yjODMlYaRDJC/pub?gid=704501126&single=true&output=csv';
const _RESULTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjR79H2FbUkdxllGsK37_U8Q-zAkyYTZcV2yS5IC-gPuOvha1Q-agxqPppXitU6nz-yjODMlYaRDJC/pub?gid=1150501903&single=true&output=csv';

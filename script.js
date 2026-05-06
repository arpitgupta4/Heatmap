/* ============================================================
   CONFIG
   ============================================================ */
const CACHE_KEY = 'heatmapDataCache_v5';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 250; // rows rendered per page

// Direct sheet URLs — used ONLY as a local-dev fallback when /api/data
// is not available (e.g. plain Python server). On Vercel these are never
// sent to the browser; the serverless function fetches them server-side.
const _STOCKS_CSV  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=0&single=true&output=csv';
const _HEATMAP_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3osxouCCViNZUmiibpkD3BrPn0DzkRylyU-Yad6E6-T5NI3bYfL1DL0wD5-NmgVpvE7j2afXv8Dx4/pub?gid=1442357326&single=true&output=csv';
const _RADAR_CSV   = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjR79H2FbUkdxllGsK37_U8Q-zAkyYTZcV2yS5IC-gPuOvha1Q-agxqPppXitU6nz-yjODMlYaRDJC/pub?gid=704501126&single=true&output=csv';

/* ============================================================
   CSV PARSING (fallback path only — used when /api/data unavailable)
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
    prevClose: _parseNumber(row['Prev Close'] || 0),
    ltp:       _parseNumber(row['LTP']       || 0),
    change:    _parseNumber(row['Change']    || 0),
    pctChange: _parseNumber(row['%Change']   || 0),
    marketCap: _parseNumber(row['MarketCap'] || 0),
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

// Fetch directly from Google Sheets (fallback for local dev)
async function _fetchFromSheets() {
  const [stocksRes, heatmapRes, radarRes] = await Promise.all([
    fetch(_STOCKS_CSV),
    fetch(_HEATMAP_CSV),
    fetch(_RADAR_CSV),
  ]);
  if (!stocksRes.ok || !heatmapRes.ok || !radarRes.ok) throw new Error('Sheet fetch failed');
  const [stocksCsv, heatmapCsv, radarCsv] = await Promise.all([
    stocksRes.text(), heatmapRes.text(), radarRes.text(),
  ]);
  return {
    stocks:  _parseCsvToObjects(stocksCsv).map(_normalizeStockRow),
    heatmap: _buildHeatmapItems(heatmapCsv),
    radar:   _parseCsvToObjects(radarCsv).map(_normalizeRadarRow),
  };
}

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const el = {
  stocksView:             document.getElementById('stocksView'),
  heatmapView:            document.getElementById('heatmapView'),
  radarView:              document.getElementById('radarView'),
  stocksBody:             document.getElementById('stocksBody'),
  radarBody:              document.getElementById('radarBody'),
  skeletonLoader:         document.getElementById('skeletonLoader'),
  errorBanner:            document.getElementById('errorBanner'),
  errorMessage:           document.getElementById('errorMessage'),
  errorRetry:             document.getElementById('errorRetry'),
  totalCount:             document.getElementById('totalCount'),
  marketSentiment:        document.getElementById('marketSentiment'),
  advDecliners:           document.getElementById('advDecliners'),
  avgChange:              document.getElementById('avgChange'),
  topGainers:             document.getElementById('topGainers'),
  topLosers:              document.getElementById('topLosers'),
  searchInput:            document.getElementById('searchInput'),
  filterSelect:           document.getElementById('filterSelect'),
  sortSelect:             document.getElementById('sortSelect'),
  directionSelect:        document.getElementById('directionSelect'),
  refreshButton:          document.getElementById('refreshButton'),
  lastUpdated:            document.getElementById('lastUpdated'),
  sentimentFill:          document.getElementById('sentimentFill'),
  sentimentGainLabel:     document.getElementById('sentimentGainLabel'),
  sentimentLossLabel:     document.getElementById('sentimentLossLabel'),
  tabButtons:             [...document.querySelectorAll('.tab-button')],
  sortableHeaders:        [...document.querySelectorAll('th.sortable')],
  radarSortableHeaders:   [...document.querySelectorAll('th.radar-sortable')],
};

/* ============================================================
   STATE
   ============================================================ */
const state = {
  stocks:         [],
  heatmap:        [],
  radar:          [],
  activeView:     'stocks',
  sortBy:         'dailyChange',
  sortDir:        'desc',
  filter:         'all',
  query:          '',
  lastFetched:    null,
  radarSortBy:    'pctChange',
  radarSortDir:   'desc',
  visibleCount:   PAGE_SIZE,
  _dirty:         { stocks: true, heatmap: true, radar: true }, // tracks which views need re-render
};

function markAllDirty() {
  state._dirty.stocks = state._dirty.heatmap = state._dirty.radar = true;
}

/* ============================================================
   UTILS
   ============================================================ */
function formatChange(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function debounce(fn, ms) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
}

function formatPrice(v)     { return `₹${v.toFixed(2)}`; }
function formatMarketCap(v) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${Math.round(v).toLocaleString('en-IN')}`;
  return `₹${v.toFixed(0)}`;
}

function relativeTime(date) {
  if (!date) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60)  return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
}

/* ============================================================
   TOAST / CLIPBOARD
   ============================================================ */
let _toastTimer = null;

function showToast(text) {
  const toast = document.getElementById('toastNotification');
  toast.innerHTML = `<span class="toast-icon">✓</span><span>${text}</span>`;
  toast.classList.remove('toast-hide', 'toast-visible');
  void toast.offsetWidth; // force reflow
  toast.classList.add('toast-visible');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.add('toast-hide');
    toast.addEventListener('transitionend', () => {
      toast.classList.remove('toast-visible', 'toast-hide');
    }, { once: true });
  }, 2000);
}

async function copyToClipboard(text) {
  if (!text || text === '—') return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied: ${text}`);
  } catch (_) {
    // Fallback for non-https / older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`Copied: ${text}`);
  }
}

/* ============================================================
   DATA LAYER — local cache
   ============================================================ */
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (_) { /* storage full — ignore */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.timestamp || !cached?.data) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return { data: cached.data, timestamp: cached.timestamp };
  } catch (_) {
    return null;
  }
}

/* ============================================================
   COMPUTE
   ============================================================ */
function summaryFromStocks(stocks) {
  const total = stocks.length;
  if (!total) return {
    total: 0, avg: '—', sentiment: 'neutral', sentimentLabel: '—',
    adv: 0, dec: 0, unch: 0, topGainers: [], topLosers: [], pctGain: 0,
  };

  const sum  = stocks.reduce((acc, s) => acc + s.dailyChange, 0);
  const avg  = (sum / total).toFixed(2);
  const sorted = [...stocks].sort((a, b) => b.dailyChange - a.dailyChange);

  const adv  = stocks.filter((s) => s.dailyChange > 0).length;
  const dec  = stocks.filter((s) => s.dailyChange < 0).length;
  const unch = total - adv - dec;
  const pctGain = Math.round((adv / total) * 100);

  // Sentiment: Bullish ≥ 60% gainers, Bearish ≤ 40%, else Neutral
  let sentiment, sentimentLabel;
  if (pctGain >= 60)      { sentiment = 'bullish';  sentimentLabel = '🟢 Bullish';  }
  else if (pctGain <= 40) { sentiment = 'bearish';  sentimentLabel = '🔴 Bearish';  }
  else                    { sentiment = 'neutral';  sentimentLabel = '🟡 Neutral';  }

  return {
    total, avg: `${avg}%`, sentiment, sentimentLabel,
    adv, dec, unch, pctGain,
    topGainers: sorted.slice(0, 5),
    topLosers:  sorted.slice(-5).reverse(),
  };
}

function filterAndSortStocks(stocks) {
  const q = state.query.toLowerCase();

  const filtered = stocks.filter((s) => {
    const content = [s.securityId, s.name, s.industry, s.group, s.subgroup]
      .join(' ').toLowerCase();
    if (q && !content.includes(q)) return false;
    if (state.filter === 'positive') return s.dailyChange > 0;
    if (state.filter === 'negative') return s.dailyChange < 0;
    return true;
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (state.sortBy === 'dailyChange') {
      cmp = a.dailyChange - b.dailyChange;
    } else {
      cmp = String(a[state.sortBy] || '').localeCompare(String(b[state.sortBy] || ''), undefined, {
        numeric: true, sensitivity: 'base',
      });
    }
    return state.sortDir === 'asc' ? cmp : -cmp;
  });
}

/* ============================================================
   RENDERING — skeleton
   ============================================================ */
function buildSkeletonRows(count = 10) {
  const patterns = [
    ['w-20', 'w-40', 'w-50', 'w-30', 'w-30', 'w-10'],
    ['w-30', 'w-60', 'w-40', 'w-20', 'w-50', 'w-10'],
    ['w-20', 'w-30', 'w-60', 'w-40', 'w-20', 'w-10'],
  ];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    const w = patterns[i % patterns.length];
    tr.innerHTML = w.map((cls) => `<td><div class="skeleton-cell ${cls}"></div></td>`).join('');
    frag.appendChild(tr);
  }
  document.getElementById('skeletonBody').innerHTML = '';
  document.getElementById('skeletonBody').appendChild(frag);
}

/* ============================================================
   RENDERING — sentiment bar
   ============================================================ */
function renderSentimentBar(pctGain) {
  el.sentimentFill.style.width = `${pctGain}%`;
  // Shorter labels on narrow screens via data attrs (CSS shows/hides)
  el.sentimentGainLabel.dataset.full  = `▲ ${pctGain}% Gaining`;
  el.sentimentGainLabel.dataset.short = `▲ ${pctGain}%`;
  el.sentimentGainLabel.textContent   = el.sentimentGainLabel.dataset.full;

  el.sentimentLossLabel.dataset.full  = `${100 - pctGain}% Losing ▼`;
  el.sentimentLossLabel.dataset.short = `${100 - pctGain}% ▼`;
  el.sentimentLossLabel.textContent   = el.sentimentLossLabel.dataset.full;
}

/* ============================================================
   RENDERING — summary cards
   ============================================================ */
function updateSummary(stocks) {
  const s = summaryFromStocks(stocks);
  el.totalCount.textContent = s.total;
  el.avgChange.textContent  = s.avg;

  // Market Sentiment chip
  el.marketSentiment.textContent       = s.sentimentLabel;
  el.marketSentiment.dataset.sentiment = s.sentiment; // CSS colours via attr

  // Adv / Decliners  e.g.  "842 ▲ / 612 ▼  (114 —)"
  el.advDecliners.innerHTML =
    `<span class="adv-count">${s.adv} ▲</span>` +
    `<span class="adv-sep"> / </span>` +
    `<span class="dec-count">${s.dec} ▼</span>` +
    (s.unch ? `<span class="unch-count"> (${s.unch} —)</span>` : '');

  renderSentimentBar(s.pctGain);

  el.topGainers.innerHTML = s.topGainers.map((item) => {
    const sym = item.securityId || item.symbol || item.name;
    return `<li class="mover-item">
      <span class="mover-symbol">${sym}</span>
      <span class="change-badge gain">${formatChange(item.dailyChange)}</span>
    </li>`;
  }).join('');

  el.topLosers.innerHTML = s.topLosers.map((item) => {
    const sym = item.securityId || item.symbol || item.name;
    return `<li class="mover-item">
      <span class="mover-symbol">${sym}</span>
      <span class="change-badge loss">${formatChange(item.dailyChange)}</span>
    </li>`;
  }).join('');
}

/* ============================================================
   RENDERING — stocks table
   ============================================================ */
function changeBadge(value) {
  const cls  = value > 0 ? 'gain' : value < 0 ? 'loss' : 'neutral';
  const icon = value > 0 ? '▲'   : value < 0 ? '▼'    : '—';
  return `<span class="change-badge ${cls}">${icon} ${formatChange(value)}</span>`;
}

function renderStocksTable(stocks) {
  if (!stocks.length) {
    el.stocksBody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>No stocks match the current filters.</p>
        </div>
      </td></tr>`;
    return;
  }

  const page = stocks.slice(0, state.visibleCount);
  const frag = document.createDocumentFragment();
  for (const s of page) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-symbol copyable" data-copy="${s.securityId}">${s.securityId}</td>
      <td class="copyable" data-copy="${s.name}">${s.name}</td>
      <td class="copyable" data-copy="${s.industry}">${s.industry}</td>
      <td class="copyable" data-copy="${s.group}">${s.group}</td>
      <td class="copyable" data-copy="${s.subgroup}">${s.subgroup}</td>
      <td class="col-change">${changeBadge(s.dailyChange)}</td>
    `;
    frag.appendChild(tr);
  }

  // "Load More" row if there are more
  if (stocks.length > state.visibleCount) {
    const more = document.createElement('tr');
    more.innerHTML = `<td colspan="6" class="load-more-cell">
      <button class="load-more-btn" id="loadMoreStocks">
        Show more (${stocks.length - state.visibleCount} remaining)
      </button>
    </td>`;
    frag.appendChild(more);
  }

  el.stocksBody.innerHTML = '';
  el.stocksBody.appendChild(frag);
  updateSortArrows();

  // Bind load-more
  const btn = document.getElementById('loadMoreStocks');
  if (btn) btn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderCurrentView();
  });
}

/* ============================================================
   RENDERING — heatmap cards
   ============================================================ */
function renderHeatmapCards(items) {
  const container = el.heatmapView;
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        <p>No heatmap data available from the sheet.</p>
      </div>`;
    return;
  }

  // Build stock count lookup: count how many stocks match each name
  // across subgroup, group, industry, and sector fields
  const stockCountMap = {};
  for (const s of state.stocks) {
    for (const field of [s.subgroup, s.group, s.industry, s.name]) {
      if (field) stockCountMap[field] = (stockCountMap[field] || 0) + 1;
    }
  }

  const grouped = items.reduce((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item);
    return acc;
  }, {});

  const frag = document.createDocumentFragment();

  Object.entries(grouped).forEach(([type, groupItems]) => {
    const section = document.createElement('section');
    section.className = 'heatmap-section';

    const header = document.createElement('div');
    header.className = 'heatmap-section-header';
    header.innerHTML = `<h2>${type}</h2><span class="count-badge">${groupItems.length}</span>`;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    const sorted = [...groupItems].sort((a, b) => b.dailyChange - a.dailyChange).slice(0, 32);
    const maxAbs = Math.max(...sorted.map((i) => Math.abs(i.dailyChange)), 0.01);

    for (const item of sorted) {
      const cardClass = item.dailyChange > 0 ? 'gain-card' : item.dailyChange < 0 ? 'loss-card' : '';
      const mag = Math.abs(item.dailyChange) / maxAbs;
      const valueFontSize = (1 + mag * 0.6).toFixed(2);
      const count = stockCountMap[item.name];
      const displayName = count ? `${item.name} (${count})` : item.name;

      const card = document.createElement('div');
      card.className = `heatmap-card copyable ${cardClass}`;
      card.dataset.copy = item.name;
      card.title = `Click to copy "${item.name}"`;
      card.innerHTML = `
        <span class="heatmap-card-name">${displayName}</span>
        <span class="heatmap-card-value" style="font-size:${valueFontSize}rem">
          ${item.dailyChange > 0 ? '▲' : item.dailyChange < 0 ? '▼' : ''} ${formatChange(item.dailyChange)}
        </span>
      `;
      grid.appendChild(card);
    }

    section.appendChild(grid);
    frag.appendChild(section);
  });

  container.appendChild(frag);
}

/* ============================================================
   RENDERING — radar table
   ============================================================ */
function renderRadarTable(items) {
  if (!items.length) {
    el.radarBody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>No radar data available.</p>
        </div>
      </td></tr>`;
    return;
  }

  const q = state.query.toLowerCase();
  let filtered = items.filter((r) => {
    if (q && !r.symbol.toLowerCase().includes(q)) return false;
    if (state.filter === 'positive') return r.pctChange > 0;
    if (state.filter === 'negative') return r.pctChange < 0;
    return true;
  });

  filtered.sort((a, b) => {
    const col = state.radarSortBy;
    let cmp = col === 'symbol'
      ? a.symbol.localeCompare(b.symbol)
      : (a[col] ?? 0) - (b[col] ?? 0);
    return state.radarSortDir === 'asc' ? cmp : -cmp;
  });

  const page = filtered.slice(0, state.visibleCount);
  const frag = document.createDocumentFragment();
  for (const r of page) {
    const ltpClass = r.ltp > r.prevClose ? 'gain' : r.ltp < r.prevClose ? 'loss' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-symbol copyable" data-copy="${r.symbol}">${r.symbol}</td>
      <td class="col-num">${formatPrice(r.prevClose)}</td>
      <td class="col-num ${ltpClass}">${formatPrice(r.ltp)}</td>
      <td class="col-num ${r.change > 0 ? 'gain' : r.change < 0 ? 'loss' : ''}">${r.change > 0 ? '+' : ''}${r.change.toFixed(2)}</td>
      <td class="col-num">${changeBadge(r.pctChange)}</td>
      <td class="col-num radar-mcap">${formatMarketCap(r.marketCap)}</td>
    `;
    frag.appendChild(tr);
  }

  if (filtered.length > state.visibleCount) {
    const more = document.createElement('tr');
    more.innerHTML = `<td colspan="6" class="load-more-cell">
      <button class="load-more-btn" id="loadMoreRadar">
        Show more (${filtered.length - state.visibleCount} remaining)
      </button>
    </td>`;
    frag.appendChild(more);
  }

  el.radarBody.innerHTML = '';
  el.radarBody.appendChild(frag);
  updateRadarSortArrows();

  const btn = document.getElementById('loadMoreRadar');
  if (btn) btn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderCurrentView();
  });
}

function updateRadarSortArrows() {
  el.radarSortableHeaders.forEach((th) => {
    const isActive = th.dataset.col === state.radarSortBy;
    th.classList.toggle('sort-active', isActive);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = isActive ? (state.radarSortDir === 'asc' ? '↑' : '↓') : '⇕';
  });
}

/* ============================================================
   UI STATE
   ============================================================ */
function setLoading(isLoading) {
  el.skeletonLoader.classList.toggle('hidden', !isLoading);
  el.stocksView.classList.add('hidden');
  el.heatmapView.classList.add('hidden');
  el.radarView.classList.add('hidden');
  el.errorBanner.classList.add('hidden');
  if (isLoading) buildSkeletonRows(12);
}

function setError(message) {
  el.skeletonLoader.classList.add('hidden');
  el.stocksView.classList.add('hidden');
  el.heatmapView.classList.add('hidden');
  el.radarView.classList.add('hidden');
  el.errorMessage.textContent = message;
  el.errorBanner.classList.remove('hidden');
}

function renderCurrentView() {
  el.skeletonLoader.classList.add('hidden');
  el.errorBanner.classList.add('hidden');

  const isStocks  = state.activeView === 'stocks';
  const isHeatmap = state.activeView === 'heatmap';
  const isRadar   = state.activeView === 'radar';

  el.stocksView.classList.toggle('hidden', !isStocks);
  el.heatmapView.classList.toggle('hidden', !isHeatmap);
  el.radarView.classList.toggle('hidden', !isRadar);

  // Only re-render the active view if its data is dirty (filters/sort/data changed).
  // Tab switching without data changes just shows/hides — instant.
  if (isStocks && state._dirty.stocks) {
    const visibleStocks = filterAndSortStocks(state.stocks);
    renderStocksTable(visibleStocks);
    updateSummary(visibleStocks);
    state._dirty.stocks = false;
  } else if (isHeatmap && state._dirty.heatmap) {
    renderHeatmapCards(state.heatmap);
    updateSummary(state.stocks);
    state._dirty.heatmap = false;
  } else if (isRadar && state._dirty.radar) {
    renderRadarTable(state.radar);
    updateSummary(state.radar.map((r) => ({ ...r, securityId: r.symbol, dailyChange: r.pctChange })));
    state._dirty.radar = false;
  }
}

function setActiveView(view) {
  state.activeView = view;
  el.tabButtons.forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderCurrentView();
}

/* ============================================================
   SORT ARROWS
   ============================================================ */
function updateSortArrows() {
  el.sortableHeaders.forEach((th) => {
    const isActive = th.dataset.col === state.sortBy;
    th.classList.toggle('sort-active', isActive);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = isActive ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕';
  });
}

/* ============================================================
   TIMESTAMP
   ============================================================ */
function updateTimestamp() {
  el.lastUpdated.textContent = `Updated ${relativeTime(state.lastFetched)}`;
}

/* ============================================================
   DATA LOAD
   Strategy: try /api/data (Vercel serverless — URL hidden from client)
             → if 404 (API not deployed), fall back to direct CSV fetch.
   This means the app works with a plain Python server locally AND on Vercel.
   ============================================================ */
async function loadData(forceRefresh = false) {
  setLoading(true);
  el.refreshButton.classList.add('loading');

  // Serve from localStorage cache first
  if (!forceRefresh) {
    const hit = loadCache();
    if (hit) {
      state.stocks      = hit.data.stocks;
      state.heatmap     = hit.data.heatmap;
      state.radar       = hit.data.radar || [];
      state.lastFetched = new Date(hit.timestamp);
      updateTimestamp();
      renderCurrentView();
      el.refreshButton.classList.remove('loading');
      return;
    }
  }

  try {
    let data; // { stocks, heatmap, radar }

    // ─ Try the secure API proxy first ──────────────────────────────
    const apiRes = await fetch('/api/data').catch(() => ({ status: 0, ok: false }));

    if (apiRes.ok) {
      // ✅ Vercel / vercel dev — data from server, sheet URL never exposed
      data = await apiRes.json();
    } else if (apiRes.status === 404 || apiRes.status === 0) {
      // ⚠️ API not available (local Python server, file://, etc.)
      console.info('[HeatmapDashboard] /api/data not found — falling back to direct CSV fetch (local dev mode)');
      data = await _fetchFromSheets();
    } else {
      throw new Error(`API error: HTTP ${apiRes.status}`);
    }

    state.stocks      = data.stocks  || [];
    state.heatmap     = data.heatmap || [];
    state.radar       = data.radar   || [];
    state.lastFetched = new Date();
    saveCache({ stocks: state.stocks, heatmap: state.heatmap, radar: state.radar });
    markAllDirty();
    updateTimestamp();
    renderCurrentView();
  } catch (err) {
    console.error('[HeatmapDashboard] Error:', err);
    setError('Unable to load data. Check your network or try refreshing.');
    el.lastUpdated.textContent = 'Failed to load';
  } finally {
    el.refreshButton.classList.remove('loading');
  }
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindEventListeners() {
  const _debouncedRender = debounce(() => renderCurrentView(), 150);
  el.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    state.visibleCount = PAGE_SIZE;
    markAllDirty();
    _debouncedRender();
  });

  el.filterSelect.addEventListener('change', (e) => {
    state.filter = e.target.value;
    state.visibleCount = PAGE_SIZE;
    markAllDirty();
    renderCurrentView();
  });

  el.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    el.directionSelect.value = 'desc';
    state.sortDir = 'desc';
    state.visibleCount = PAGE_SIZE;
    markAllDirty();
    renderCurrentView();
  });

  el.directionSelect.addEventListener('change', (e) => {
    state.sortDir = e.target.value;
    state.visibleCount = PAGE_SIZE;
    markAllDirty();
    renderCurrentView();
  });

  el.refreshButton.addEventListener('click', () => loadData(true));
  el.errorRetry.addEventListener('click',    () => loadData(true));

  el.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.visibleCount = PAGE_SIZE;
      setActiveView(btn.dataset.view);
    });
  });

  // Column header click sorting
  el.sortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortBy === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy  = col;
        state.sortDir = col === 'dailyChange' ? 'desc' : 'asc';
      }
      el.sortSelect.value      = state.sortBy;
      el.directionSelect.value = state.sortDir;
      state._dirty.stocks = true;
      renderCurrentView();
    });
  });

  // Keyboard: "/" focuses search, Escape clears it
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== el.searchInput) {
      e.preventDefault();
      el.searchInput.focus();
      el.searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === el.searchInput) {
      el.searchInput.value = '';
      state.query = '';
      renderCurrentView();
      el.searchInput.blur();
    }
  });

  // Relative timestamp ticker
  setInterval(updateTimestamp, 30_000);

  // Copy to clipboard — stocks table
  el.stocksBody.addEventListener('click', (e) => {
    const td = e.target.closest('td.copyable');
    if (!td) return;
    copyToClipboard(td.dataset.copy || td.textContent.trim());
  });

  // Copy to clipboard — heatmap cards
  el.heatmapView.addEventListener('click', (e) => {
    const card = e.target.closest('.heatmap-card.copyable');
    if (!card) return;
    copyToClipboard(card.dataset.copy || '');
  });

  // Copy to clipboard — radar table
  el.radarBody.addEventListener('click', (e) => {
    const td = e.target.closest('td.copyable');
    if (!td) return;
    copyToClipboard(td.dataset.copy || td.textContent.trim());
  });

  // Radar column header click sort
  el.radarSortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.radarSortBy === col) {
        state.radarSortDir = state.radarSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.radarSortBy  = col;
        state.radarSortDir = col === 'symbol' ? 'asc' : 'desc';
      }
      state._dirty.radar = true;
      renderCurrentView();
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
bindEventListeners();
loadData();

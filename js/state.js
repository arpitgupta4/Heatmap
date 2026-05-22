/* ============================================================
   STATE — application state object and DOM element references
   ============================================================ */

// ─── DOM References ────────────────────────────────────────────────────────────
const el = {
  stocksView:           document.getElementById('stocksView'),
  heatmapView:          document.getElementById('heatmapView'),
  radarView:            document.getElementById('radarView'),
  resultsView:          document.getElementById('resultsView'),
  controlsPanel:        document.getElementById('controlsPanel'),
  summaryPanel:         document.getElementById('summaryPanel'),
  sentimentContainer:   document.getElementById('sentimentContainer'),
  contentPanel:         document.getElementById('contentPanel'),
  resultsSearchInput:   document.getElementById('resultsSearchInput'),
  stocksBody:           document.getElementById('stocksBody'),
  radarBody:            document.getElementById('radarBody'),
  resultsBody:          document.getElementById('resultsBody'),
  resultsDateStrip:     document.getElementById('resultsDateStrip'),
  resultsDateSection:   document.getElementById('resultsDateSection'),
  skeletonLoader:       document.getElementById('skeletonLoader'),
  errorBanner:          document.getElementById('errorBanner'),
  errorMessage:         document.getElementById('errorMessage'),
  errorRetry:           document.getElementById('errorRetry'),
  totalCount:           document.getElementById('totalCount'),
  marketSentiment:      document.getElementById('marketSentiment'),
  advDecliners:         document.getElementById('advDecliners'),
  avgChange:            document.getElementById('avgChange'),
  topGainers:           document.getElementById('topGainers'),
  topLosers:            document.getElementById('topLosers'),
  searchInput:          document.getElementById('searchInput'),
  filterSelect:         document.getElementById('filterSelect'),
  sortSelect:           document.getElementById('sortSelect'),
  directionSelect:      document.getElementById('directionSelect'),
  refreshButton:        document.getElementById('refreshButton'),
  lastUpdated:          document.getElementById('lastUpdated'),
  sentimentFill:        document.getElementById('sentimentFill'),
  sentimentGainLabel:   document.getElementById('sentimentGainLabel'),
  sentimentLossLabel:   document.getElementById('sentimentLossLabel'),
  tabButtons:           [...document.querySelectorAll('.tab-button')],
  sortableHeaders:      [...document.querySelectorAll('th.sortable')],
  radarSortableHeaders: [...document.querySelectorAll('th.radar-sortable')],
};

// ─── Application State ─────────────────────────────────────────────────────────
const state = {
  stocks:         [],
  heatmap:        [],
  radar:          [],
  radarSummary:   {},  // pre-computed from sheet (Total Stocks, %Change, Advance, Decliners, Sentiment)
  results:        [],  // results/corporate actions from sheet
  resultsToday:   '',  // today's date from sheet
  activeView:     'stocks',
  sortBy:         'dailyChange',
  sortDir:        'desc',
  filter:         'all',
  query:          '',
  resultsQuery:   '',
  lastFetched:    null,
  radarSortBy:    'pctChange',
  radarSortDir:   'desc',
  visibleCount:   PAGE_SIZE,
  _dirty:         { stocks: true, heatmap: true, radar: true, results: true },
};

function markAllDirty() {
  state._dirty.stocks = state._dirty.heatmap = state._dirty.radar = state._dirty.results = true;
}

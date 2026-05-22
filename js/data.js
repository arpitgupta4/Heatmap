/* ============================================================
   DATA — fetch, cache, render orchestration
   ============================================================ */

// ─── Timestamp ─────────────────────────────────────────────────────────────────
function updateTimestamp() {
  el.lastUpdated.textContent = `Updated ${relativeTime(state.lastFetched)}`;
}

// ─── Render Current View ───────────────────────────────────────────────────────
function renderCurrentView() {
  el.skeletonLoader.classList.add('hidden');
  el.errorBanner.classList.add('hidden');

  const isStocks  = state.activeView === 'stocks';
  const isHeatmap = state.activeView === 'heatmap';
  const isRadar   = state.activeView === 'radar';
  const isResults = state.activeView === 'results';

  el.stocksView.classList.toggle('hidden', !isStocks);
  el.heatmapView.classList.toggle('hidden', !isHeatmap);
  el.radarView.classList.toggle('hidden', !isRadar);
  el.resultsView.classList.toggle('hidden', !isResults);

  el.controlsPanel.classList.toggle('hidden', isResults);
  el.summaryPanel.classList.toggle('hidden', isResults);
  el.sentimentContainer.classList.toggle('hidden', isResults);
  el.contentPanel.classList.toggle('hidden', isResults);

  if (isStocks) {
    if (state._dirty.stocks) {
      state._filteredStocks = filterAndSortStocks(state.stocks);
      renderStocksTable(state._filteredStocks);
      state._dirty.stocks = false;
    }
    updateSummary(state._filteredStocks || filterAndSortStocks(state.stocks));
  } else if (isHeatmap) {
    if (state._dirty.heatmap) {
      renderHeatmapCards(state.heatmap);
      state._dirty.heatmap = false;
    }
    updateSummary(state.stocks);
  } else if (isRadar) {
    if (state._dirty.radar) {
      renderRadarTable(state.radar);
      state._dirty.radar = false;
    }
    updateRadarSummary(state.radarSummary);
  } else if (isResults) {
    if (state._dirty.results) {
      renderResultsView();
      state._dirty.results = false;
    }
  }
}

// Pre-render inactive tabs so first switch is instant
function preRenderHidden() {
  requestAnimationFrame(() => {
    if (state._dirty.stocks && state.activeView !== 'stocks') {
      state._filteredStocks = state._filteredStocks || filterAndSortStocks(state.stocks);
      renderStocksTable(state._filteredStocks);
      state._dirty.stocks = false;
    }
    if (state._dirty.heatmap && state.activeView !== 'heatmap') {
      renderHeatmapCards(state.heatmap);
      state._dirty.heatmap = false;
    }
    if (state._dirty.radar && state.activeView !== 'radar') {
      renderRadarTable(state.radar);
      state._dirty.radar = false;
    }
    if (state._dirty.results && state.activeView !== 'results') {
      renderResultsView();
      state._dirty.results = false;
    }
  });
}

// ─── Load Data ─────────────────────────────────────────────────────────────────
// Strategy: try /api/data (Vercel serverless — URL hidden from client)
//           → if 404/0 (API not deployed), fall back to direct CSV fetch.
async function loadData(forceRefresh = false) {
  setLoading(true);
  el.refreshButton.classList.add('loading');

  // Serve from localStorage cache first
  if (!forceRefresh) {
    const hit = loadCache();
    if (hit) {
      state.stocks       = hit.data.stocks;
      state.heatmap      = hit.data.heatmap;
      state.radar        = hit.data.radar        || [];
      state.radarSummary = hit.data.radarSummary || {};
      state.results      = hit.data.results      || [];
      state.resultsToday = hit.data.resultsToday || '';
      state.lastFetched  = new Date(hit.timestamp);
      state._filteredStocks = filterAndSortStocks(state.stocks);
      updateTimestamp();
      renderCurrentView();
      preRenderHidden();
      el.refreshButton.classList.remove('loading');
      return;
    }
  }

  try {
    let data;

    const apiUrl = forceRefresh ? `/api/data?t=${Date.now()}` : '/api/data';
    const apiRes = await fetch(apiUrl).catch(() => ({ status: 0, ok: false }));

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

    state.stocks       = data.stocks       || [];
    state.heatmap      = data.heatmap      || [];
    state.radar        = data.radar        || [];
    state.radarSummary = data.radarSummary || {};
    state.radarError   = data.radarError   || false;
    state.results      = data.results      || [];
    state.resultsToday = data.resultsToday || '';
    state.lastFetched  = new Date();
    state._filteredStocks = filterAndSortStocks(state.stocks);

    saveCache({
      stocks: state.stocks, heatmap: state.heatmap,
      radar: state.radar, radarSummary: state.radarSummary,
      results: state.results, resultsToday: state.resultsToday,
    });

    markAllDirty();
    updateTimestamp();
    renderCurrentView();
    preRenderHidden();
  } catch (err) {
    console.error('[HeatmapDashboard] Error:', err);
    setError('Unable to load data. Check your network or try refreshing.');
    el.lastUpdated.textContent = 'Failed to load';
  } finally {
    el.refreshButton.classList.remove('loading');
  }
}

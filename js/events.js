/* ============================================================
   EVENTS — event binding and app initialization (loaded last)
   ============================================================ */
function bindEventListeners() {
  const _debouncedRender        = debounce(() => renderCurrentView(), 150);
  const _debouncedResultsRender = debounce(() => renderResultsView(),  150);

  // ─── Search ─────────────────────────────────────────────────────────────────
  el.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    state.visibleCount = PAGE_SIZE;
    markAllDirty();
    _debouncedRender();
  });

  if (el.resultsSearchInput) {
    el.resultsSearchInput.addEventListener('input', (e) => {
      state.resultsQuery = e.target.value.trim();
      _debouncedResultsRender();
    });
  }

  // ─── Filter / Sort ──────────────────────────────────────────────────────────
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

  // ─── Refresh / Retry ────────────────────────────────────────────────────────
  el.refreshButton.addEventListener('click', () => loadData(true));
  el.errorRetry.addEventListener('click',    () => loadData(true));

  // ─── Tabs ───────────────────────────────────────────────────────────────────
  el.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.visibleCount = PAGE_SIZE;
      setActiveView(btn.dataset.view);
    });
  });

  // ─── Stocks column header sort ───────────────────────────────────────────────
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

  // ─── Radar column header sort ────────────────────────────────────────────────
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

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
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

  // ─── Relative timestamp ticker ───────────────────────────────────────────────
  setInterval(updateTimestamp, 30_000);

  // ─── Copy to clipboard — event delegation per container ──────────────────────
  el.stocksBody.addEventListener('click', (e) => {
    const td = e.target.closest('td.copyable');
    if (!td) return;
    copyToClipboard(td.dataset.copy || td.textContent.trim());
  });

  el.heatmapView.addEventListener('click', (e) => {
    const card = e.target.closest('.heatmap-card.copyable');
    if (!card) return;
    copyToClipboard(card.dataset.copy || '');
  });

  el.radarBody.addEventListener('click', (e) => {
    const td = e.target.closest('td.copyable');
    if (!td) return;
    copyToClipboard(td.dataset.copy || td.textContent.trim());
  });

  el.resultsDateSection.addEventListener('click', (e) => {
    const td = e.target.closest('td.copyable');
    if (!td) return;
    copyToClipboard(td.dataset.copy || td.textContent.trim());
  });
}

// ─── Init ──────────────────────────────────────────────────────────────────────
bindEventListeners();
loadData();

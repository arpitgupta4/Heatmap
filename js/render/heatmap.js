/* ============================================================
   RENDER — heatmap cards with Theme / Sector / Industry toggles
   ============================================================ */
function renderHeatmapCards(items) {
  const container = el.heatmapView;
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5">
          <rect x="3"  y="3"  width="7" height="7"/>
          <rect x="14" y="3"  width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3"  y="14" width="7" height="7"/>
        </svg>
        <p>No heatmap data available from the sheet.</p>
      </div>`;
    return;
  }

  // ── Stock-count lookup: count how many stocks map to each name ────────────
  const stockCountMap = {};
  for (const s of state.stocks) {
    for (const field of [s.parentTheme, s.sectorName, s.industry]) {
      if (field) stockCountMap[field] = (stockCountMap[field] || 0) + 1;
    }
  }

  // ── Discover available types (preserving sheet order) ────────────────────
  const types = [...new Set(items.map((i) => i.type))];

  // Default to first type; reset if saved filter no longer exists in data
  if (!state.heatmapFilter || !types.includes(state.heatmapFilter)) {
    state.heatmapFilter = types[0] || null;
  }

  // ── Toggle bar ───────────────────────────────────────────────────────────
  const toggleBar = document.createElement('div');
  toggleBar.className = 'heatmap-toggle-bar';

  types.forEach((type) => {
    const count = items.filter((i) => i.type === type).length;
    const btn   = document.createElement('button');
    btn.className   = 'heatmap-toggle-btn' + (type === state.heatmapFilter ? ' active' : '');
    btn.dataset.type = type;
    btn.innerHTML   = `${escHtml(type)}<span class="heatmap-toggle-count">${count}</span>`;
    btn.setAttribute('aria-pressed', type === state.heatmapFilter ? 'true' : 'false');

    btn.addEventListener('click', () => {
      if (state.heatmapFilter === type) return;       // already active
      state.heatmapFilter = type;
      state._dirty.heatmap = true;
      renderHeatmapCards(state.heatmap);
    });
    toggleBar.appendChild(btn);
  });
  container.appendChild(toggleBar);

  // ── Filter + sort items for the active type ──────────────────────────────
  const filtered = items.filter((i) => i.type === state.heatmapFilter);
  const sorted   = [...filtered].sort((a, b) => b.dailyChange - a.dailyChange);
  const maxAbs   = Math.max(...sorted.map((i) => Math.abs(i.dailyChange)), 0.01);

  // ── Card grid ────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  // Fade in on toggle switch
  grid.style.animation = 'fade-in 0.25s ease-out forwards';

  for (const item of sorted) {
    const cardClass     = item.dailyChange > 0 ? 'gain-card' : item.dailyChange < 0 ? 'loss-card' : '';
    const mag           = Math.abs(item.dailyChange) / maxAbs;
    const valueFontSize = (1 + mag * 0.6).toFixed(2);
    const count         = stockCountMap[item.name];
    const displayName   = count ? `${escHtml(item.name)} (${count})` : escHtml(item.name);

    const card = document.createElement('div');
    card.className    = `heatmap-card copyable ${cardClass}`;
    card.dataset.copy = item.name;
    card.title        = `Click to copy "${item.name}"`;
    card.innerHTML    = `
      <span class="heatmap-card-name">${displayName}</span>
      <span class="heatmap-card-value" style="font-size:${valueFontSize}rem">
        ${item.dailyChange > 0 ? '▲' : item.dailyChange < 0 ? '▼' : ''} ${formatChange(item.dailyChange)}
      </span>
    `;
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

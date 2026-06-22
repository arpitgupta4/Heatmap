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

  // ── Stock-count lookup ────────────────────────────────────────────────────
  const stockCountMap = {};
  for (const s of state.stocks) {
    for (const field of [s.parentTheme, s.sectorName, s.industry]) {
      if (field) stockCountMap[field] = (stockCountMap[field] || 0) + 1;
    }
  }

  // ── Discover available types (preserving sheet order) ────────────────────
  const types = [...new Set(items.map((i) => i.type))];
  if (!state.heatmapFilter || !types.includes(state.heatmapFilter)) {
    state.heatmapFilter = types[0] || null;
  }

  // ── Toggle bar ───────────────────────────────────────────────────────────
  const toggleBar = document.createElement('div');
  toggleBar.className = 'heatmap-toggle-bar';

  types.forEach((type) => {
    const cnt = items.filter((i) => i.type === type).length;
    const btn = document.createElement('button');
    btn.className    = 'heatmap-toggle-btn' + (type === state.heatmapFilter ? ' active' : '');
    btn.dataset.type = type;
    btn.setAttribute('aria-pressed', type === state.heatmapFilter ? 'true' : 'false');
    btn.innerHTML    = `${escHtml(type)}<span class="heatmap-toggle-count">${cnt}</span>`;
    btn.addEventListener('click', () => {
      if (state.heatmapFilter === type) return;
      state.heatmapFilter = type;
      state._dirty.heatmap = true;
      renderHeatmapCards(state.heatmap);
    });
    toggleBar.appendChild(btn);
  });
  container.appendChild(toggleBar);

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered  = items.filter((i) => i.type === state.heatmapFilter);
  const sorted    = [...filtered].sort((a, b) => b.dailyChange - a.dailyChange);
  const maxAbs    = Math.max(...sorted.map((i) => Math.abs(i.dailyChange)), 0.01);

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const gainers   = sorted.filter((i) => i.dailyChange > 0).length;
  const losers    = sorted.filter((i) => i.dailyChange < 0).length;
  const unchanged = sorted.length - gainers - losers;
  const avgRaw    = sorted.length
    ? sorted.reduce((s, i) => s + i.dailyChange, 0) / sorted.length
    : 0;
  const avgStr    = (avgRaw >= 0 ? '+' : '') + avgRaw.toFixed(2) + '%';
  const avgCls    = avgRaw > 0 ? 'hm-stat-gain' : avgRaw < 0 ? 'hm-stat-loss' : '';

  const statsBar  = document.createElement('div');
  statsBar.className = 'heatmap-stats-bar';
  statsBar.innerHTML = `
    <span class="hm-stat"><span class="hm-stat-gain">${gainers} ▲</span> Gaining</span>
    <span class="hm-stat-sep">·</span>
    <span class="hm-stat"><span class="hm-stat-loss">${losers} ▼</span> Losing</span>
    ${unchanged ? `<span class="hm-stat-sep">·</span><span class="hm-stat">${unchanged} —</span>` : ''}
    <span class="hm-stat-sep">·</span>
    <span class="hm-stat">Avg <strong class="${avgCls}">${avgStr}</strong></span>
    <span class="hm-stat-right">${sorted.length} items</span>
  `;
  container.appendChild(statsBar);

  // ── Adaptive grid column width based on item count ───────────────────────
  const colMin = sorted.length > 200 ? '120px'
               : sorted.length > 80  ? '145px'
               :                       '170px';

  // ── Card grid ────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  grid.style.cssText = `
    grid-template-columns: repeat(auto-fill, minmax(${colMin}, 1fr));
    animation: fade-in 0.22s ease-out forwards;
  `;

  for (const item of sorted) {
    const isGain = item.dailyChange > 0;
    const isLoss = item.dailyChange < 0;
    const cardClass     = isGain ? 'gain-card' : isLoss ? 'loss-card' : '';
    const mag           = Math.abs(item.dailyChange) / maxAbs;          // 0 – 1
    const valueFontSize = (0.95 + mag * 0.55).toFixed(2);
    const count         = stockCountMap[item.name];
    const displayName   = count ? `${escHtml(item.name)} (${count})` : escHtml(item.name);

    const card = document.createElement('div');
    card.className    = `heatmap-card copyable ${cardClass}`;
    card.dataset.copy = item.name;
    card.title        = `Click to copy "${item.name}"`;
    // Pass magnitude as CSS custom property for intensity-based coloring
    card.style.setProperty('--mag', mag.toFixed(3));
    card.innerHTML    = `
      <span class="heatmap-card-name">${displayName}</span>
      <span class="heatmap-card-value" style="font-size:${valueFontSize}rem">
        ${isGain ? '▲' : isLoss ? '▼' : '–'} ${formatChange(item.dailyChange)}
      </span>
    `;
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

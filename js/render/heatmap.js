/* ============================================================
   RENDER — heatmap cards
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

  // Build stock-count lookup: count how many stocks match each name
  // across subgroup, group, industry, and sector fields
  const stockCountMap = {};
  for (const s of state.stocks) {
    for (const field of [s.parentTheme,s.sectorName,s.industry]) {
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
    header.innerHTML = `<h2>${escHtml(type)}</h2><span class="count-badge">${groupItems.length}</span>`;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    const sorted = [...groupItems].sort((a, b) => b.dailyChange - a.dailyChange).slice(0, 32);
    const maxAbs = Math.max(...sorted.map((i) => Math.abs(i.dailyChange)), 0.01);

    for (const item of sorted) {
      const cardClass     = item.dailyChange > 0 ? 'gain-card' : item.dailyChange < 0 ? 'loss-card' : '';
      const mag           = Math.abs(item.dailyChange) / maxAbs;
      const valueFontSize = (1 + mag * 0.6).toFixed(2);
      const count         = stockCountMap[item.name];
      const displayName   = count ? `${escHtml(item.name)} (${count})` : escHtml(item.name);

      const card = document.createElement('div');
      card.className    = `heatmap-card copyable ${cardClass}`;
      card.dataset.copy = item.name;           // raw value for clipboard
      card.title        = `Click to copy "${item.name}"`;
      card.innerHTML    = `
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

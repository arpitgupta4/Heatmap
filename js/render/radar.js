/* ============================================================
   RENDER — radar table and summary cards
   ============================================================ */

// ─── Summary Cards (Radar tab — reads pre-computed summary from api) ───────────
function updateRadarSummary(s) {
  el.totalCount.textContent = s.totalStocks || '—';
  el.avgChange.textContent  = `${(s.pctChange || 0).toFixed(2)}%`;

  const sentMap = { Bullish: 'bullish', Bearish: 'bearish', Neutral: 'neutral' };
  const key     = sentMap[s.sentiment] || 'neutral';
  const emoji   = { bullish: '🟢', bearish: '🔴', neutral: '🟡' };
  el.marketSentiment.textContent       = `${emoji[key]} ${s.sentiment}`;
  el.marketSentiment.dataset.sentiment = key;

  const unch = (s.totalStocks || 0) - (s.advance || 0) - (s.decliners || 0);
  el.advDecliners.innerHTML =
    `<span class="adv-count">${s.advance}\u00a0▲</span>` +
    `<span class="adv-sep"> / </span>` +
    `<span class="dec-count">${s.decliners}\u00a0▼</span>` +
    (unch > 0 ? `<span class="unch-count"> (${unch}\u00a0—)</span>` : '');

  const pctGain = s.totalStocks ? Math.round((s.advance / s.totalStocks) * 100) : 50;
  renderSentimentBar(pctGain);

  const sorted = [...state.radar].sort((a, b) => b.pctChange - a.pctChange);
  el.topGainers.innerHTML = sorted.slice(0, 5).map((r) =>
    `<li class="mover-item"><span class="mover-symbol">${escHtml(r.symbol)}</span><span class="change-badge gain">${formatChange(r.pctChange)}</span></li>`
  ).join('');
  el.topLosers.innerHTML = sorted.slice(-5).reverse().map((r) =>
    `<li class="mover-item"><span class="mover-symbol">${escHtml(r.symbol)}</span><span class="change-badge loss">${formatChange(r.pctChange)}</span></li>`
  ).join('');
}

// ─── Radar Table ───────────────────────────────────────────────────────────────
function renderRadarTable(items) {
  if (state.radarError) {
    el.radarBody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p style="color: var(--loss);">Google Sheets Formula Error: The published sheet returned <b>#VALUE!</b>.</p>
          <p style="font-size: 0.85rem; opacity: 0.8; max-width: 400px; margin: 8px auto 0;">Your Google Sheet is failing to evaluate formulas for the public web. Check your source data.</p>
        </div>
      </td></tr>`;
    return;
  }

  if (!items.length) {
    el.radarBody.innerHTML = `
      <tr><td colspan="7">
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
    const isGain   = r.ltp > r.high;
    const ltpClass = r.ltp > r.prevClose ? 'gain' : r.ltp < r.prevClose ? 'loss' : '';
    const rowClass = isGain ? 'row-highlight-gain' : '';
    const tr = document.createElement('tr');
    if (rowClass) tr.className = rowClass;
    tr.innerHTML = `
      <td class="col-symbol copyable" data-copy="${escHtml(r.symbol)}">${escHtml(r.symbol)}</td>
      <td class="col-num">${formatPrice(r.high)}</td>
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
    more.innerHTML = `<td colspan="7" class="load-more-cell">
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

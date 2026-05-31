/* ============================================================
   RENDER — stocks table, sentiment bar, summary cards
   ============================================================ */

// ─── Change Badge ──────────────────────────────────────────────────────────────
function changeBadge(value) {
  const cls  = value > 0 ? 'gain' : value < 0 ? 'loss' : 'neutral';
  const icon = value > 0 ? '▲'   : value < 0 ? '▼'    : '—';
  return `<span class="change-badge ${cls}">${icon} ${formatChange(value)}</span>`;
}

// ─── Sentiment Bar ─────────────────────────────────────────────────────────────
function renderSentimentBar(pctGain) {
  el.sentimentFill.style.width = `${pctGain}%`;
  el.sentimentGainLabel.dataset.full  = `▲ ${pctGain}% Gaining`;
  el.sentimentGainLabel.dataset.short = `▲ ${pctGain}%`;
  el.sentimentGainLabel.textContent   = el.sentimentGainLabel.dataset.full;

  el.sentimentLossLabel.dataset.full  = `${100 - pctGain}% Losing ▼`;
  el.sentimentLossLabel.dataset.short = `${100 - pctGain}% ▼`;
  el.sentimentLossLabel.textContent   = el.sentimentLossLabel.dataset.full;
}

// ─── Summary Cards (Stocks / Heatmap tabs) ─────────────────────────────────────
function updateSummary(stocks) {
  const s = summaryFromStocks(stocks);
  el.totalCount.textContent = s.total;
  el.avgChange.textContent  = s.avg;

  el.marketSentiment.textContent       = s.sentimentLabel;
  el.marketSentiment.dataset.sentiment = s.sentiment;

  el.advDecliners.innerHTML =
    `<span class="adv-count">${s.adv} ▲</span>` +
    `<span class="adv-sep"> / </span>` +
    `<span class="dec-count">${s.dec} ▼</span>` +
    (s.unch ? `<span class="unch-count"> (${s.unch} —)</span>` : '');

  renderSentimentBar(s.pctGain);

  el.topGainers.innerHTML = s.topGainers.map((item) => {
    const sym = escHtml(item.securityId || item.symbol || item.name);
    return `<li class="mover-item">
      <span class="mover-symbol">${sym}</span>
      <span class="change-badge gain">${formatChange(item.dailyChange)}</span>
    </li>`;
  }).join('');

  el.topLosers.innerHTML = s.topLosers.map((item) => {
    const sym = escHtml(item.securityId || item.symbol || item.name);
    return `<li class="mover-item">
      <span class="mover-symbol">${sym}</span>
      <span class="change-badge loss">${formatChange(item.dailyChange)}</span>
    </li>`;
  }).join('');
}

// ─── Stocks Table ──────────────────────────────────────────────────────────────
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
    // escHtml on all data fields to prevent XSS from malicious CSV content
    tr.innerHTML = `
      <td class="col-symbol copyable" data-copy="${escHtml(s.securityId)}">${escHtml(s.securityId)}</td>
      <td class="copyable" data-copy="${escHtml(s.name)}">${escHtml(s.name)}</td>
      <td class="copyable" data-copy="${escHtml(s.industry)}">${escHtml(s.industry)}</td>
      <td class="copyable" data-copy="${escHtml(s.group)}">${escHtml(s.group)}</td>
      <td class="copyable" data-copy="${escHtml(s.subgroup)}">${escHtml(s.subgroup)}</td>
      <td class="col-change">${changeBadge(s.dailyChange)}</td>
    `;
    frag.appendChild(tr);
  }

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

  const btn = document.getElementById('loadMoreStocks');
  if (btn) btn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderCurrentView();
  });
}

// ─── Sort Arrows (Stocks table) ────────────────────────────────────────────────
function updateSortArrows() {
  el.sortableHeaders.forEach((th) => {
    const isActive = th.dataset.col === state.sortBy;
    th.classList.toggle('sort-active', isActive);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = isActive ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕';
  });
}

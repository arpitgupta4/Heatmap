/* ============================================================
   RENDER — results (corporate actions) date-grouped view
   ============================================================ */

// ─── Date Helpers ──────────────────────────────────────────────────────────────
function _parseDateDMY(str) {
  // "07-May-2026" → Date object
  const parts = str.match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (!parts) return null;
  return new Date(`${parts[2]} ${parts[1]}, ${parts[3]}`);
}

function _formatDateLabel(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function _formatDateKey(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ─── Date Section (table for a selected date) ──────────────────────────────────
function _renderDateSection(dateKey, groupedByDate, stockMap) {
  const items = groupedByDate[dateKey] || [];
  if (!items.length) {
    el.resultsDateSection.innerHTML = `<div class="results-empty">No results scheduled for this date</div>`;
    return;
  }

  const rows = items.map((r) => {
    const s      = stockMap[r.symbol] || {};
    const pct    = s.dailyChange;
    const pctHtml = pct != null ? changeBadge(pct) : '—';

    return `<tr>
      <td class="col-symbol copyable" data-copy="${escHtml(r.symbol)}">${escHtml(r.symbol)}</td>
      <td class="copyable" data-copy="${escHtml(s.name || '')}">${escHtml(s.name || '—')}</td>
      <td class="copyable" data-copy="${escHtml(s.industry || '')}">${escHtml(s.industry || '—')}</td>
      <td class="copyable" data-copy="${escHtml(s.group || '')}">${escHtml(s.group || '—')}</td>
      <td class="copyable" data-copy="${escHtml(s.subgroup || '')}">${escHtml(s.subgroup || '—')}</td>
      <td class="copyable" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
          title="${escHtml(r.purpose || '')}" data-copy="${escHtml(r.purpose || '')}">${escHtml(r.purpose || '—')}</td>
      <td class="col-change">${pctHtml}</td>
    </tr>`;
  }).join('');

  el.resultsDateSection.innerHTML = `
    <div class="results-date-header">${items.length} result${items.length > 1 ? 's' : ''} on ${escHtml(dateKey)}</div>
    <div class="table-wrapper" style="animation: fade-in 0.4s ease-out forwards;">
      <table class="stocks-table" aria-label="Results list">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Sector</th>
            <th>Industry</th>
            <th>Group</th>
            <th>Subgroup</th>
            <th>Purpose</th>
            <th style="text-align:right">% Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── Main Results View ─────────────────────────────────────────────────────────
function renderResultsView() {
  let results = state.results;
  if (state.resultsQuery) {
    const q = state.resultsQuery.toLowerCase();
    results = results.filter((r) =>
      r.symbol.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q)
    );
  }

  if (!state.results.length) {
    el.resultsDateStrip.innerHTML = '<p style="text-align:center;opacity:.5">No results data available</p>';
    el.resultsDateSection.innerHTML = '';
    return;
  }

  // Build stock lookup for cross-referencing sector/industry/%change
  const stockMap = {};
  state.stocks.forEach((s) => { stockMap[s.securityId] = s; });

  // Filter out results whose stock has no sector/industry metadata at all.
  // BUG FIX: the old check `(s.dailyChange === 0 && !s.dailyChange)` was always
  // true for 0, so stocks with exactly 0% change were wrongly excluded.
  // Fixed: only exclude when dailyChange is genuinely missing (null/undefined).
  results = results.filter((r) => {
    const s = stockMap[r.symbol];
    if (!s) return false;
    if (!s.name || !s.industry || !s.group || !s.subgroup) return false;
    if (s.name === '—' || s.industry === '—') return false;
    if (s.dailyChange == null) return false;   // ← fixed: was (=== 0 && !s.dailyChange)
    return true;
  });

  // Parse today's date from sheet
  const today = _parseDateDMY(state.resultsToday) || new Date();
  today.setHours(0, 0, 0, 0);
  const todayKeyStr = _formatDateKey(today);

  // Group results by date key
  const groupedByDate = {};
  results.forEach((r) => {
    const rd = _parseDateDMY(r.date);
    if (!rd) return;
    const key = _formatDateKey(rd);
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(r);
  });

  let datePills  = [];
  let initialKey = todayKeyStr;

  if (state.resultsQuery) {
    // Search mode — only dates that have matching results
    const uniqueDates = Array.from(new Set(results.map((r) => r.date)));
    const sortedDates = uniqueDates.map(_parseDateDMY).filter(Boolean).sort((a, b) => a - b);
    datePills = sortedDates.map((d, index) => {
      const key = _formatDateKey(d);
      return { date: d, label: _formatDateLabel(d), key, isToday: key === todayKeyStr, isActive: index === 0 };
    });
    if (datePills.length > 0) initialKey = datePills[0].key;
  } else {
    // Default mode — ALL unique dates present in the sheet, sorted chronologically
    const allDatesInSheet = Array.from(
      new Set(state.results.map((r) => r.date))
    )
      .map((d) => _parseDateDMY(d))
      .filter(Boolean)
      .sort((a, b) => a - b);

    datePills = allDatesInSheet.map((d) => {
      const key = _formatDateKey(d);
      return {
        date: d,
        label: _formatDateLabel(d),
        key,
        isToday:  key === todayKeyStr,
        isActive: key === todayKeyStr,
      };
    });

    // Default to today if present; otherwise pick the closest upcoming date
    const todayPill = datePills.find((p) => p.isActive);
    if (!todayPill && datePills.length > 0) {
      const now = Date.now();
      const closest = datePills.reduce((prev, cur) =>
        Math.abs(cur.date - now) < Math.abs(prev.date - now) ? cur : prev
      );
      closest.isActive = true;
      initialKey = closest.key;
    }
  }

  if (datePills.length === 0 && state.resultsQuery) {
    el.resultsDateStrip.innerHTML = '';
    el.resultsDateSection.innerHTML = `<div class="results-empty">No results found for "${escHtml(state.resultsQuery)}"</div>`;
    return;
  }

  // Render date pills strip
  el.resultsDateStrip.innerHTML = datePills.map((p) => {
    const count   = (groupedByDate[p.key] || []).length;
    const classes = ['results-date-pill'];
    if (p.isToday)  classes.push('today');
    if (p.isActive) classes.push('active');
    return `<button class="${classes.join(' ')}" data-datekey="${escHtml(p.key)}">
      <span class="pill-label">${escHtml(p.label)}</span>
      <span class="pill-count">${count}</span>
    </button>`;
  }).join('');

  // Auto-scroll the active pill into view (centered)
  requestAnimationFrame(() => {
    const activePill = el.resultsDateStrip.querySelector('.results-date-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  // Click handler for pills
  el.resultsDateStrip.querySelectorAll('.results-date-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.resultsDateStrip.querySelectorAll('.results-date-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      _renderDateSection(btn.dataset.datekey, groupedByDate, stockMap);
    });
  });

  _renderDateSection(initialKey, groupedByDate, stockMap);
}

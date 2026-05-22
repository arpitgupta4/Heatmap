/* ============================================================
   COMPUTE — derived data calculations (reads state, no DOM writes)
   ============================================================ */
function summaryFromStocks(stocks) {
  const total = stocks.length;
  if (!total) return {
    total: 0, avg: '—', sentiment: 'neutral', sentimentLabel: '—',
    adv: 0, dec: 0, unch: 0, topGainers: [], topLosers: [], pctGain: 0,
  };

  const sum    = stocks.reduce((acc, s) => acc + s.dailyChange, 0);
  const avg    = (sum / total).toFixed(2);
  const sorted = [...stocks].sort((a, b) => b.dailyChange - a.dailyChange);

  const adv  = stocks.filter((s) => s.dailyChange > 0).length;
  const dec  = stocks.filter((s) => s.dailyChange < 0).length;
  const unch = total - adv - dec;
  const pctGain = Math.round((adv / total) * 100);

  // Sentiment: Bullish ≥ 60% gainers, Bearish ≤ 40%, else Neutral
  let sentiment, sentimentLabel;
  if (pctGain >= 60)      { sentiment = 'bullish'; sentimentLabel = '🟢 Bullish'; }
  else if (pctGain <= 40) { sentiment = 'bearish'; sentimentLabel = '🔴 Bearish'; }
  else                    { sentiment = 'neutral'; sentimentLabel = '🟡 Neutral'; }

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

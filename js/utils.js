/* ============================================================
   UTILS — pure helper functions (no DOM, no state)
   ============================================================ */
function formatChange(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function debounce(fn, ms) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
}

function formatPrice(v)     { return `₹${v.toFixed(2)}`; }

function formatMarketCap(v) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${Math.round(v).toLocaleString('en-IN')}`;
  return `₹${v.toFixed(0)}`;
}

function relativeTime(date) {
  if (!date) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60)  return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
}

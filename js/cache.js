/* ============================================================
   CACHE — localStorage persistence layer
   ============================================================ */
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (_) { /* storage full — ignore */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.timestamp || !cached?.data) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return { data: cached.data, timestamp: cached.timestamp };
  } catch (_) {
    return null;
  }
}

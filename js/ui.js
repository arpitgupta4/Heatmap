/* ============================================================
   UI — loading/error states, skeleton, tab switching
   ============================================================ */

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
function buildSkeletonRows(count = 10) {
  const patterns = [
    ['w-20', 'w-40', 'w-50', 'w-30', 'w-30', 'w-10'],
    ['w-30', 'w-60', 'w-40', 'w-20', 'w-50', 'w-10'],
    ['w-20', 'w-30', 'w-60', 'w-40', 'w-20', 'w-10'],
  ];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    const w = patterns[i % patterns.length];
    tr.innerHTML = w.map((cls) => `<td><div class="skeleton-cell ${cls}"></div></td>`).join('');
    frag.appendChild(tr);
  }
  document.getElementById('skeletonBody').innerHTML = '';
  document.getElementById('skeletonBody').appendChild(frag);
}

// ─── Loading / Error States ────────────────────────────────────────────────────
function setLoading(isLoading) {
  el.skeletonLoader.classList.toggle('hidden', !isLoading);
  el.stocksView.classList.add('hidden');
  el.heatmapView.classList.add('hidden');
  el.radarView.classList.add('hidden');
  el.resultsView.classList.add('hidden');
  el.errorBanner.classList.add('hidden');
  if (isLoading) buildSkeletonRows(12);
}

function setError(message) {
  el.skeletonLoader.classList.add('hidden');
  el.stocksView.classList.add('hidden');
  el.heatmapView.classList.add('hidden');
  el.radarView.classList.add('hidden');
  el.resultsView.classList.add('hidden');
  el.errorMessage.textContent = message;
  el.errorBanner.classList.remove('hidden');
}

// ─── Toast / Clipboard ─────────────────────────────────────────────────────────
let _toastTimer = null;

function showToast(text) {
  const toast = document.getElementById('toastNotification');
  toast.innerHTML = `<span class="toast-icon">✓</span><span>${text}</span>`;
  toast.classList.remove('toast-hide', 'toast-visible');
  void toast.offsetWidth; // force reflow
  toast.classList.add('toast-visible');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.add('toast-hide');
    toast.addEventListener('transitionend', () => {
      toast.classList.remove('toast-visible', 'toast-hide');
    }, { once: true });
  }, 2000);
}

async function copyToClipboard(text) {
  if (!text || text === '—') return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied: ${text}`);
  } catch (_) {
    // Fallback for older browsers / non-HTTPS contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      // execCommand is deprecated but still widely supported as a last resort
      const ok = document.execCommand('copy');
      if (ok) showToast(`Copied: ${text}`);
    } finally {
      document.body.removeChild(ta);
    }
  }
}

// ─── Tab Switching ─────────────────────────────────────────────────────────────
function setActiveView(view) {
  state.activeView = view;
  el.tabButtons.forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderCurrentView();
}

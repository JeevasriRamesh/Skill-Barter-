(() => {
  const el = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof getToken === 'function' && !getToken()) {
      window.location.href = 'index.html';
      return;
    }

    el('logoutBtn')?.addEventListener('click', () => {
      clearAuth();
      window.location.href = 'index.html';
    });

    if (typeof bindRequestListsDelegation === 'function') bindRequestListsDelegation();
    if (typeof loadSessionsOverview === 'function') await loadSessionsOverview();
    if (typeof initDashboardChat === 'function') initDashboardChat();
  });
})();


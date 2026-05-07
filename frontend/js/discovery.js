(() => {
  const ensure = () => {
    if (typeof getToken === 'function' && !getToken()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  };

  const el = (id) => document.getElementById(id);

  const starsHtml = (avg) => {
    const val = Number(avg || 0);
    const full = Math.round(val);
    const s = Array.from({ length: 5 })
      .map((_, i) => `<span class="star ${i < full ? 'star-on' : ''}">★</span>`)
      .join('');
    return `<span class="stars" title="${val.toFixed(1)}">${s}</span><span class="muted"> ${val.toFixed(1)}</span>`;
  };

  const userCard = (u) => {
    const defaultAvatar =
      (typeof window !== 'undefined' && window.SKILLBARTER_DEFAULT_AVATAR) ||
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%25" height="100%25" fill="%231f2937"/><circle cx="60" cy="48" r="18" fill="%239ca3af"/><rect x="26" y="74" width="68" height="30" rx="15" fill="%239ca3af"/></svg>';
    const pic =
      typeof resolveProfilePictureSrc === 'function'
        ? resolveProfilePictureSrc(u.profilePicture)
        : u.profilePicture
          ? `${API_BASE}${String(u.profilePicture)}`
          : defaultAvatar;

    const offered = (u.skillsOffered || []).slice(0, 6);
    const wanted = (u.skillsWanted || []).slice(0, 6);

    const safePic = typeof escapeAttr === 'function' ? escapeAttr(pic) : String(pic);
    const safeDefault = typeof escapeAttr === 'function' ? escapeAttr(defaultAvatar) : String(defaultAvatar);

    return `
      <div class="user-card" data-user-id="${u._id}">
        <div class="user-card-top">
          <img class="user-avatar" src="${safePic}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${safeDefault}'" />
          <div class="user-meta">
            <div class="user-title">
              <span>${escapeHtml(u.name)}</span>
              ${u.isVerified ? '<span class="tag status-accepted">Verified</span>' : ''}
            </div>
            <div class="muted">${escapeHtml(u.email || '')}</div>
            <div class="muted">${u.age ? `Age ${u.age}` : ''}</div>
            <div class="rating-row">${starsHtml(u.averageRating || 0)} <span class="muted">(${u.ratingCount || 0})</span></div>
          </div>
        </div>
        <div class="skill-badges">
          ${offered.map((s) => `<span class="skill-badge offered">${escapeHtml(s)}</span>`).join('')}
          ${wanted.map((s) => `<span class="skill-badge wanted">${escapeHtml(s)}</span>`).join('')}
        </div>
        <div class="user-card-actions">
          <button type="button" class="btn btn-small primary-btn" data-action="send-request" data-user-id="${u._id}" ${typeof hasSentRequestToUser === 'function' && hasSentRequestToUser(u._id) ? 'disabled' : ''}>${typeof hasSentRequestToUser === 'function' && hasSentRequestToUser(u._id) ? 'Sent' : 'Send Request'}</button>
          <button type="button" class="btn btn-small secondary-btn" data-action="like-user" data-user-id="${u._id}">Like</button>
        </div>
      </div>
    `;
  };

  async function loadUsers(page = 1) {
    const container = el('discoveryUsers');
    const paginationContainer = el('discoveryPagination');
    const notifyWrap = el('notifyMeWrap');
    const skillVal = (el('discoverySkill')?.value || '').trim();
    const searchVal = (el('discoverySearch')?.value || '').trim();

    if (!container) return;

    const params = { page, limit: 12 };
    if (searchVal) params.search = searchVal;
    if (skillVal) params.skill = skillVal;

    const qs =
      typeof paginationUtils !== 'undefined'
        ? paginationUtils.buildQueryString(params)
        : Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');

    const restore =
      typeof loading !== 'undefined'
        ? loading.inline(container, 'Loading users...')
        : (() => {
            container.innerHTML = '<p class="muted">Loading users...</p>';
            return () => {};
          })();

    try {
      if (typeof loadSentRequestTargetIds === 'function') await loadSentRequestTargetIds();
      const resp = await authFetch(`${API_BASE}/api/users?${qs}`);
      restore();
      const users = Array.isArray(resp.data) ? resp.data : [];

      if (!users.length) {
        container.innerHTML = '<p class="muted">No users found.</p>';
        if (notifyWrap) {
          notifyWrap.style.display = skillVal ? 'block' : 'none';
        }
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
      }

      if (notifyWrap) notifyWrap.style.display = 'none';

      // Vertical stacked list (clean + scrollable)
      container.innerHTML = `<div class="user-card-list">${users.map(userCard).join('')}</div>`;

      if (paginationContainer && resp.pagination && typeof paginationUtils !== 'undefined') {
        paginationUtils.renderPagination(paginationContainer, resp.pagination, (p) => loadUsers(p));
      } else if (paginationContainer) {
        paginationContainer.innerHTML = '';
      }
    } catch (err) {
      restore();
      container.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
      if (paginationContainer) paginationContainer.innerHTML = '';
    }
  }

  function bind() {
    const logoutBtn = el('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
      clearAuth();
      window.location.href = 'index.html';
    });

    let t;
    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(() => loadUsers(1), 350);
    };

    el('discoverySearch')?.addEventListener('input', schedule);
    el('discoverySkill')?.addEventListener('input', schedule);
    el('discoveryClearBtn')?.addEventListener('click', () => {
      if (el('discoverySearch')) el('discoverySearch').value = '';
      if (el('discoverySkill')) el('discoverySkill').value = '';
      loadUsers(1);
    });

    el('notifyMeBtn')?.addEventListener('click', async () => {
      const skillName = (el('discoverySkill')?.value || '').trim();
      if (!skillName) return;
      try {
        await authFetch(`${API_BASE}/api/skills/notify`, {
          method: 'POST',
          body: JSON.stringify({ skillName })
        });
        showAlert('Subscribed. We will email you when available.', 'success');
      } catch (e) {
        showAlert(e.message, 'error');
      }
    });

    // Delegation for Like (Send Request already delegated globally)
    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action="like-user"]');
      if (!btn) return;
      e.stopPropagation();
      const userId = btn.getAttribute('data-user-id');
      if (!userId) return;
      try {
        await authFetch(`${API_BASE}/api/users/${userId}/like`, { method: 'POST' });
        showAlert('Liked', 'success');
        btn.disabled = true;
        btn.textContent = 'Liked';
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!ensure()) return;
    if (typeof bindSendRequestDelegation === 'function') bindSendRequestDelegation();
    if (typeof bindUserProfileDelegation === 'function') bindUserProfileDelegation();
    bind();
    loadUsers(1);
  });
})();


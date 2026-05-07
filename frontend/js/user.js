(() => {
  const el = (id) => document.getElementById(id);

  const getUserIdFromPath = () => {
    const path = window.location.pathname || '';
    const m = path.match(/\/user\/([^\/?#]+)/i);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  };

  const renderSkillBadges = (skills, cls) => {
    const arr = Array.isArray(skills) ? skills.filter(Boolean) : [];
    if (!arr.length) return '<span class="muted">Not specified</span>';
    return arr.map((s) => `<span class="skill-badge ${cls}">${escapeHtml(s)}</span>`).join('');
  };

  const updateSendButtonState = async (targetUserId) => {
    const btn = el('userProfileSendRequestBtn');
    if (!btn) return;
    try {
      if (typeof loadSentRequestTargetIds === 'function') {
        await loadSentRequestTargetIds();
      }
      const isSent = typeof hasSentRequestToUser === 'function' && hasSentRequestToUser(targetUserId);
      if (isSent) {
        btn.textContent = 'Sent';
        btn.disabled = true;
      } else {
        btn.textContent = 'Send Request';
        btn.disabled = false;
      }
    } catch {
      // non-fatal
    }
  };

  const showIntentPicker = () => {
    const wrap = el('userProfileIntentWrap');
    if (wrap) wrap.style.display = 'block';
  };
  const hideIntentPicker = () => {
    const wrap = el('userProfileIntentWrap');
    if (wrap) wrap.style.display = 'none';
  };
  const readIntent = () => {
    const checked = document.querySelector('input[name="userProfileIntent"]:checked');
    const v = String(checked?.value || 'learn').toLowerCase();
    return v === 'teach' ? 'teach' : v === 'both' ? 'both' : 'learn';
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof getToken === 'function' && !getToken()) {
      window.location.href = '/index.html';
      return;
    }

    el('logoutBtn')?.addEventListener('click', () => {
      clearAuth();
      window.location.href = '/index.html';
    });
    el('userProfileBackBtn')?.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/discovery.html';
      }
    });

    const userId = getUserIdFromPath();
    if (!userId) {
      showAlert('Invalid user profile URL', 'error');
      return;
    }

    try {
      const user = await authFetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`);

      const avatarEl = el('userProfileAvatar');
      const avatar = typeof resolveProfilePictureSrc === 'function'
        ? resolveProfilePictureSrc(user.profilePicture)
        : (user.profilePicture ? `${API_BASE}${String(user.profilePicture)}` : (window.SKILLBARTER_DEFAULT_AVATAR || ''));
      if (avatarEl) {
        avatarEl.src = avatar;
        avatarEl.onerror = () => {
          avatarEl.onerror = null;
          avatarEl.src = window.SKILLBARTER_DEFAULT_AVATAR || '';
        };
      }

      if (el('userProfileName')) el('userProfileName').textContent = user.name || 'User';
      if (el('userProfileEmail')) el('userProfileEmail').textContent = user.email || '';

      if (el('userProfileBio')) {
        el('userProfileBio').textContent = user.bio || 'No bio yet';
      }

      if (el('userProfileSkillsOffered')) {
        el('userProfileSkillsOffered').innerHTML = renderSkillBadges(user.skillsOffered, 'offered');
      }
      if (el('userProfileSkillsWanted')) {
        el('userProfileSkillsWanted').innerHTML = renderSkillBadges(user.skillsWanted, 'wanted');
      }

      if (el('userProfileRating')) {
        el('userProfileRating').textContent = `${Number(user.averageRating || 0).toFixed(1)} (${Number(user.ratingCount || 0)})`;
      }

      const vEl = el('userProfileVerification');
      if (vEl) {
        const isV = !!user.isVerified;
        vEl.textContent = isV ? 'Verified' : 'Not verified';
        vEl.className = `tag ${isV ? 'status-accepted' : 'status-pending'}`;
      }

      await updateSendButtonState(user._id);

      const sendBtn = el('userProfileSendRequestBtn');
      const confirmBtn = el('userProfileConfirmSendBtn');
      const cancelBtn = el('userProfileCancelIntentBtn');

      sendBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (sendBtn.disabled) return;
        showIntentPicker();
      });

      cancelBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideIntentPicker();
      });

      confirmBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user._id) return;
        const intent = readIntent();

        let restore = null;
        try {
          if (typeof loading !== 'undefined') restore = loading.button(confirmBtn, 'Sending…');
          await sendExchangeRequest(user._id, { intent });
          if (typeof markRequestSentForUser === 'function') markRequestSentForUser(user._id);
          if (restore) restore();
          hideIntentPicker();
          showAlert('Request sent successfully', 'success');
          await updateSendButtonState(user._id);
        } catch (err) {
          if (restore) restore();
          showAlert(err.message, 'error');
        }
      });
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
})();


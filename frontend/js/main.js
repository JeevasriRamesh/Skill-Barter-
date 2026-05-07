const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://skill-barter-hxhk.onrender.com';

const getToken = () => localStorage.getItem('token');
const getRole = () => localStorage.getItem('role');

const setAuth = (token, role = 'user') => {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
};

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
};

const authFetch = async (url, options = {}) => {
  const token = getToken();
  // Merge caller headers first, then force JSON + Bearer so token is never dropped
  const headers = {
    ...(options.headers || {}),
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  // Only treat 401 as invalid session — 403 is often "forbidden for this resource", not bad token
  if (res.status === 401) {
    clearAuth();
    if (!window.location.pathname.endsWith('index.html')) {
      window.location.href = 'index.html';
    }
    throw new Error(data.message || 'Unauthorized');
  }

  if (res.status === 403) {
    throw new Error(data.message || 'Forbidden');
  }

  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.errors = data.errors || {};
    error.data = data;
    throw error;
  }

  return data;
};

const authFetchForm = async (url, options = {}) => {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearAuth();
    if (!window.location.pathname.endsWith('index.html')) {
      window.location.href = 'index.html';
    }
    throw new Error(data.message || 'Unauthorized');
  }
  if (res.status === 403) {
    throw new Error(data.message || 'Forbidden');
  }
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.errors = data.errors || {};
    error.data = data;
    throw error;
  }
  return data;
};

// Toast notifications replace alert()
const showAlert = (message, type = 'info') => {
  if (typeof toast !== 'undefined') {
    toast.show(message, type);
  } else {
    // Fallback to alert if toast not loaded
    alert(message);
  }
};

const ensureUser = () => {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
};

const ensureAdmin = () => {
  if (!getToken() || getRole() !== 'admin') {
    window.location.href = 'index.html';
  }
};

const parseSkills = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const formatSkills = (skills) =>
  (skills && skills.length ? skills.join(', ') : 'Not specified');

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
};

const escapeAttr = (text) => {
  // Attribute-safe encoding (prevents breaking out of quotes)
  return escapeHtml(text).replace(/`/g, '&#96;');
};

const SKILLBARTER_DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%25" height="100%25" fill="%231f2937"/><circle cx="60" cy="48" r="18" fill="%239ca3af"/><rect x="26" y="74" width="68" height="30" rx="15" fill="%239ca3af"/></svg>';

// Expose default avatar for other scripts (discovery.js loads after main.js)
if (typeof window !== 'undefined') {
  window.SKILLBARTER_DEFAULT_AVATAR = SKILLBARTER_DEFAULT_AVATAR;
}

const resolveProfilePictureSrc = (profilePicture) => {
  const raw = (profilePicture == null ? '' : String(profilePicture)).trim();
  if (!raw) return SKILLBARTER_DEFAULT_AVATAR;

  // Only accept a safe uploads path. This prevents broken HTML when raw HTML/attributes
  // accidentally got stored in the DB (e.g. `alt="..." loading="lazy" ...`).
  if (raw.startsWith('/uploads/')) return `${API_BASE}${raw}`;

  // If someone stored a full URL (optional legacy), allow only http(s) and no whitespace.
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;

  return SKILLBARTER_DEFAULT_AVATAR;
};

const resolveUploadUrl = (value) => {
  const raw = (value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;
  return `${API_BASE}/${raw.replace(/^\/+/, '')}`;
};

const verificationStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  return 'rejected';
};

const sentRequestTargetIds = new Set();
let sentRequestsLoaded = false;

const markRequestSentForUser = (userId) => {
  if (!userId) return;
  sentRequestTargetIds.add(String(userId));
};

const hasSentRequestToUser = (userId) => sentRequestTargetIds.has(String(userId || ''));

const loadSentRequestTargetIds = async () => {
  if (sentRequestsLoaded) return;
  let page = 1;
  const maxPages = 20;
  while (page <= maxPages) {
    const response = await authFetch(
      `${API_BASE}/api/requests/sent?page=${page}&limit=50`
    );
    const rows = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
    rows.forEach((r) => {
      if (r?.status === 'rejected') return;
      const id = r?.toUser?._id || r?.toUser;
      if (id) sentRequestTargetIds.add(String(id));
    });
    const p = response.pagination;
    if (!p || !p.hasNextPage) break;
    page += 1;
  }
  sentRequestsLoaded = true;
};

const goToUserProfile = (userId) => {
  if (!userId) return;
  window.location.href = `/user/${encodeURIComponent(String(userId))}`;
};

const verificationStatusClass = (status) => {
  if (status === 'approved') return 'status-accepted';
  if (status === 'rejected') return 'status-rejected';
  return 'status-pending';
};

// Render helpers
const renderUserCard = (user, actionsHtml = '') => {
  const offered = user.skillsOffered || [];
  const wanted = user.skillsWanted || [];
  const avatar = resolveProfilePictureSrc(user.profilePicture);

  return `
    <div class="list-item" data-user-id="${user._id}" data-action="view-profile">
      <div class="list-item-header">
        <div class="user-card-top">
          <img class="user-avatar" src="${escapeAttr(avatar)}" alt="Profile photo" loading="lazy" onerror="this.onerror=null;this.src='${escapeAttr(SKILLBARTER_DEFAULT_AVATAR)}'" />
          <div>
          <div class="list-item-title">${user.name} ${user.isVerified ? '<span class="tag status-accepted">Verified</span>' : ''}</div>
          <div class="list-item-subtitle">${user.email}</div>
          </div>
        </div>
      </div>
      <div class="skill-badges">
        ${offered
          .map((s) => `<span class="skill-badge offered">${s}</span>`)
          .join('')}
        ${wanted
          .map((s) => `<span class="skill-badge wanted">${s}</span>`)
          .join('')}
      </div>
      <div class="list-item-footer">
        <span class="muted">${user.bio || 'No bio yet'}${user.averageRating ? ` • Rating ${user.averageRating} (${user.ratingCount || 0})` : ''}</span>
        <div>${actionsHtml}</div>
      </div>
    </div>
  `;
};

const renderRequestCard = (request, isSent, includeActions = false, session = null) => {
  const otherUser = isSent ? request.toUser : request.fromUser;
  const statusClass =
    request.status === 'accepted'
      ? 'status-accepted'
      : request.status === 'rejected'
      ? 'status-rejected'
      : 'status-pending';

  let actionsHtml = '';

  if (includeActions && !isSent && request.status === 'pending') {
    actionsHtml = `
      <button class="btn btn-small primary-btn" data-action="accept" data-request-id="${request._id}">Accept</button>
      <button class="btn btn-small secondary-btn" data-action="reject" data-request-id="${request._id}">Reject</button>
    `;
  }

  let sessionHtml = '';
  if (session) {
    const pct = session.progressPercentage ?? 0;
    sessionHtml = `
      <div class="session-info card-session">
        <div class="session-info-label">Learning progress</div>
        <div class="progress-row">
          <div class="progress-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="progress-text">${pct}%</span>
        </div>
        <div class="session-count muted">${session.completedSessions} / ${session.totalSessions} sessions completed</div>
        ${session.status !== 'completed' ? `<button type="button" class="btn btn-small primary-btn" data-action="complete-session" data-session-id="${session._id}" data-request-id="${request._id}">Mark session complete</button>` : '<span class="tag status-accepted">Exchange completed</span>'}
      </div>
    `;
  } else if (request.status === 'accepted') {
    sessionHtml = `<p class="muted session-pending">Session is loading… refresh if this persists.</p>`;
  }

  return `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${otherUser?.name || 'Unknown user'}</div>
          <div class="list-item-subtitle">
            ${isSent ? 'To' : 'From'}: ${otherUser?.email || '-'}
          </div>
        </div>
        <span class="tag ${statusClass}">${request.status}</span>
      </div>
      <div class="list-item-subtitle">
        You offer <strong>${request.offeredSkill}</strong> in exchange for
        <strong>${request.requestedSkill}</strong>.
      </div>
      <div class="list-item-footer">
        <span class="muted">Created: ${new Date(request.createdAt).toLocaleString()}</span>
        <div>${actionsHtml}</div>
      </div>
      ${sessionHtml}
    </div>
`;
};

// Page initializers
const initLoginPage = () => {
  const form = document.getElementById('loginForm');
  const isAdminLogin = document.getElementById('isAdminLogin');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    if (typeof validationUtils !== 'undefined') {
      validationUtils.clearFormErrors(form);
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    // Frontend validation
    if (typeof validationUtils !== 'undefined') {
      const emailValidation = validationUtils.validateEmail(email);
      if (!emailValidation.valid) {
        validationUtils.showFormErrors(form, { loginEmail: emailValidation.error });
        showAlert(emailValidation.error, 'warning');
        return;
      }

      if (!password) {
        validationUtils.showFormErrors(form, { loginPassword: 'Password is required' });
        showAlert('Password is required', 'warning');
        return;
      }
    } else {
      // Fallback validation
      if (!email || !password) {
        showAlert('Please enter email and password', 'warning');
        return;
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreButton = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Logging in...') : null;

    try {
      if (isAdminLogin.checked) {
        const data = await authFetch(`${API_BASE}/api/admin/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (restoreButton) restoreButton();
        setAuth(data.token, 'admin');
        showAlert('Login successful', 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 500);
      } else {
        const data = await authFetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (restoreButton) restoreButton();
        setAuth(data.token, data.user?.role || 'user');
        showAlert('Login successful', 'success');
        setTimeout(() => {
          window.location.href = data.user?.role === 'admin' ? 'admin.html' : 'discovery.html';
        }, 500);
      }
    } catch (err) {
      if (restoreButton) restoreButton();
      
      // Handle validation errors
      if (err.errors && typeof validationUtils !== 'undefined') {
        validationUtils.showFormErrors(form, err.errors);
      }
      
      // Show error message
      if (err.errors && Array.isArray(err.errors)) {
        // Array of errors (from skill validation)
        err.errors.forEach((errorMsg) => {
          showAlert(errorMsg, 'error');
        });
      } else {
        showAlert(err.message, 'error');
      }
    }
  });
};

const initRegisterPage = () => {
  const form = document.getElementById('registerForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    if (typeof validationUtils !== 'undefined') {
      validationUtils.clearFormErrors(form);
    }

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    // Frontend validation
    if (typeof validationUtils !== 'undefined') {
      const errors = {};
      const nameValidation = validationUtils.validateName(name);
      if (!nameValidation.valid) {
        errors.registerName = nameValidation.error;
      }

      const emailValidation = validationUtils.validateEmail(email);
      if (!emailValidation.valid) {
        errors.registerEmail = emailValidation.error;
      }

      const passwordValidation = validationUtils.validatePassword(password);
      if (!passwordValidation.valid) {
        errors.registerPassword = passwordValidation.error;
      }

      if (Object.keys(errors).length > 0) {
        validationUtils.showFormErrors(form, errors);
        showAlert('Please fix the errors in the form', 'warning');
        return;
      }
    } else {
      // Fallback validation
      if (!name || !email || !password) {
        showAlert('Please fill all fields', 'warning');
        return;
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreButton = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Creating account...') : null;

    try {
      const data = await authFetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      if (restoreButton) restoreButton();
      setAuth(data.token, data.user?.role || 'user');
      showAlert('Account created successfully', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
    } catch (err) {
      if (restoreButton) restoreButton();
      
      // Handle validation errors
      if (err.errors && typeof validationUtils !== 'undefined') {
        validationUtils.showFormErrors(form, err.errors);
      }
      
      // Show error message
      if (err.errors && Array.isArray(err.errors)) {
        err.errors.forEach((errorMsg) => {
          showAlert(errorMsg, 'error');
        });
      } else {
        showAlert(err.message, 'error');
      }
    }
  });
};

const initDashboardPage = async () => {
  ensureUser();
  bindUserProfileDelegation();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      window.location.href = 'index.html';
    });
  }

  try {
    const user = await authFetch(`${API_BASE}/api/users/me`);

    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileBio').textContent = user.bio || 'No bio yet';
    document.getElementById('profileSkillsOffered').textContent = formatSkills(user.skillsOffered);
    document.getElementById('profileSkillsWanted').textContent = formatSkills(user.skillsWanted);

    document.getElementById('bio').value = user.bio || '';
    document.getElementById('skillsOffered').value = (user.skillsOffered || []).join(', ');
    document.getElementById('skillsWanted').value = (user.skillsWanted || []).join(', ');
    const statusEl = document.getElementById('profileVerificationStatus');
    if (statusEl) {
      const status = user.verificationStatus || 'rejected';
      statusEl.className = `tag ${verificationStatusClass(status)}`;
      statusEl.textContent = status;
    }
    const proofEl = document.getElementById('verificationProofLink');
    if (proofEl) {
      proofEl.innerHTML = user.verificationProof
        ? `Proof: <a href="${API_BASE}${user.verificationProof}" target="_blank" rel="noopener noreferrer">View uploaded file</a>`
        : 'Proof: Not uploaded';
    }
    const avgEl = document.getElementById('profileAverageRating');
    const countEl = document.getElementById('profileRatingCount');
    if (avgEl) avgEl.textContent = Number(user.averageRating || 0).toFixed(1);
    if (countEl) countEl.textContent = String(user.ratingCount || 0);
    loadProfileRatings(user._id || user.id);
  } catch (err) {
    console.error(err);
  }

  const verificationForm = document.getElementById('verificationForm');
  if (verificationForm) {
    verificationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('verificationFile');
      const file = fileInput?.files?.[0];
      if (!file) {
        showAlert('Select a proof file first', 'warning');
        return;
      }
      const formData = new FormData();
      formData.append('proof', file);
      const submitBtn = verificationForm.querySelector('button[type="submit"]');
      let restore = null;
      try {
        if (typeof loading !== 'undefined') restore = loading.button(submitBtn, 'Uploading...');
        const resp = await authFetchForm(`${API_BASE}/api/users/upload-verification`, {
          method: 'POST',
          body: formData
        });
        if (restore) restore();
        showAlert(resp.message || 'Verification uploaded', 'success');
        const user = resp.user || {};
        const statusEl = document.getElementById('profileVerificationStatus');
        if (statusEl) {
          statusEl.className = `tag ${verificationStatusClass(user.verificationStatus || 'pending')}`;
          statusEl.textContent = user.verificationStatus || 'pending';
        }
        const proofEl = document.getElementById('verificationProofLink');
        if (proofEl && user.verificationProof) {
          proofEl.innerHTML = `Proof: <a href="${API_BASE}${user.verificationProof}" target="_blank" rel="noopener noreferrer">View uploaded file</a>`;
        }
      } catch (err) {
        if (restore) restore();
        showAlert(err.message, 'error');
      }
    });
  }

  const profileForm = document.getElementById('profileForm');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    if (typeof validationUtils !== 'undefined') {
      validationUtils.clearFormErrors(profileForm);
    }

    const bio = document.getElementById('bio').value.trim();
    const skillsOffered = parseSkills(document.getElementById('skillsOffered').value);
    const skillsWanted = parseSkills(document.getElementById('skillsWanted').value);

    const submitBtn = profileForm.querySelector('button[type="submit"]');
    const restoreButton = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Saving...') : null;

    try {
      const data = await authFetch(`${API_BASE}/api/users/me`, {
        method: 'PUT',
        body: JSON.stringify({ bio, skillsOffered, skillsWanted })
      });
      if (restoreButton) restoreButton();

      const updated = data.user;
      document.getElementById('profileBio').textContent = updated.bio || 'No bio yet';
      document.getElementById('profileSkillsOffered').textContent = formatSkills(updated.skillsOffered);
      document.getElementById('profileSkillsWanted').textContent = formatSkills(updated.skillsWanted);
      
      // Update form fields with cleaned data (duplicates removed)
      document.getElementById('bio').value = updated.bio || '';
      document.getElementById('skillsOffered').value = (updated.skillsOffered || []).join(', ');
      document.getElementById('skillsWanted').value = (updated.skillsWanted || []).join(', ');
      
      showAlert('Profile updated successfully', 'success');

      loadMatchedUsers();
    } catch (err) {
      if (restoreButton) restoreButton();
      
      // Handle validation errors
      if (err.errors && typeof validationUtils !== 'undefined') {
        validationUtils.showFormErrors(profileForm, err.errors);
      }
      
      // Show error message
      if (err.errors && Array.isArray(err.errors)) {
        err.errors.forEach((errorMsg) => {
          showAlert(errorMsg, 'error');
        });
      } else {
        showAlert(err.message, 'error');
      }
    }
  });

  bindRequestListsDelegation();
  bindSendRequestDelegation();
  loadMatchedUsers();
  loadRequestsSummary();
  await loadSessionsOverview();
  initDashboardChat();
};

const loadProfileRatings = async (userId) => {
  const el = document.getElementById('profileRatingsList');
  if (!el || !userId) return;
  try {
    const ratings = await authFetch(`${API_BASE}/api/ratings/user/${userId}`);
    if (!ratings.length) {
      el.innerHTML = '<p class="muted">No feedback yet.</p>';
      return;
    }
    el.innerHTML = ratings
      .map(
        (r) => `<div class="list-item">
          <div class="list-item-header">
            <div class="list-item-title">${'★'.repeat(Number(r.rating || 0))}</div>
            <div class="list-item-subtitle">from ${escapeHtml(r.fromUser?.name || 'User')}</div>
          </div>
          <div class="muted">${escapeHtml(r.feedback || '')}</div>
        </div>`
      )
      .join('');
  } catch (err) {
    el.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
};

const renderMatchUserRows = (users, emptyMsg) => {
  if (!users || !users.length) {
    return `<p class="muted">${emptyMsg}</p>`;
  }
  return users
    .map((user) =>
      renderUserCard(
        user,
        `<button type="button" class="btn btn-small primary-btn" data-action="send-request" data-user-id="${user._id}" ${hasSentRequestToUser(user._id) ? 'disabled' : ''}>
            ${hasSentRequestToUser(user._id) ? 'Sent' : 'Send Request'}
          </button>`
      )
    )
    .join('');
};

const loadMatchedUsers = async () => {
  const mutualEl = document.getElementById('matchedMutualList');
  const partialEl = document.getElementById('matchedPartialList');
  if (!mutualEl || !partialEl) return;

  const restoreM =
    typeof loading !== 'undefined'
      ? loading.inline(mutualEl, 'Loading…')
      : (() => {
          mutualEl.innerHTML = '<p class="muted">Loading…</p>';
          return () => {};
        })();
  const restoreP =
    typeof loading !== 'undefined'
      ? loading.inline(partialEl, 'Loading…')
      : (() => {
          partialEl.innerHTML = '<p class="muted">Loading…</p>';
          return () => {};
        })();

  try {
    await loadSentRequestTargetIds();
    const response = await authFetch(`${API_BASE}/api/users/match`);
    restoreM();
    restoreP();

    const mutualMatches = Array.isArray(response.mutualMatches) ? response.mutualMatches : [];
    const partialMatches = Array.isArray(response.partialMatches) ? response.partialMatches : [];

    mutualEl.innerHTML = renderMatchUserRows(
      mutualMatches,
      'No mutual matches yet — check partial matches below, or add complementary skills.'
    );

    partialEl.innerHTML = renderMatchUserRows(
      partialMatches,
      'No partial matches — browse users or expand your skills.'
    );
  } catch (err) {
    restoreM();
    restoreP();
    mutualEl.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    partialEl.innerHTML = `<p class="muted">Could not load matches.</p>`;
  }
};

const sendExchangeRequest = async (receiverId, bodyExtra = {}) => {
  return authFetch(`${API_BASE}/api/requests`, {
    method: 'POST',
    body: JSON.stringify({ receiverId, ...bodyExtra })
  });
};

const askRequestIntent = async () => {
  if (typeof modal === 'undefined') {
    const raw = prompt('Choose intent:\nEnter: learn OR teach OR both', 'learn');
    const v = String(raw || '').trim().toLowerCase();
    return v === 'teach' ? 'teach' : v === 'both' ? 'both' : 'learn';
  }

  if (typeof modal.choice === 'function') {
    const picked = await modal.choice(
      'Choose intent for this request',
      [
        { value: 'learn', label: 'Only want to learn' },
        { value: 'teach', label: 'Only want to teach' },
        { value: 'both', label: 'Both' }
      ],
      'Request intent'
    );
    return picked || 'learn';
  }

  // Fallback for older modal: prompt-style selection
  const raw = await modal.prompt('Enter intent: learn / teach / both', 'Request intent', 'learn');
  const v = String(raw || '').trim().toLowerCase();
  return v === 'teach' ? 'teach' : v === 'both' ? 'both' : 'learn';
};

const handleSendRequestClick = async (e) => {
  const btn = e.target.closest('[data-action="send-request"]');
  if (!btn) return;

  const userId = btn.getAttribute('data-user-id');
  if (!userId) return;

  let restoreButton = null;
  try {
    if (typeof loading !== 'undefined') {
      restoreButton = loading.button(btn, 'Sending…');
    }
    // Intent selection is handled on the dedicated profile page.
    await sendExchangeRequest(userId);
    markRequestSentForUser(userId);
    btn.disabled = true;
    btn.textContent = 'Sent';
    if (restoreButton) restoreButton();
    showAlert('Request sent successfully', 'success');
    if (document.getElementById('sentRequestsList')) {
      loadRequestsSummary();
    }
  } catch (err) {
    if (restoreButton) restoreButton();

    let errorMessage = err.message;
    if (err.errors) {
      if (Array.isArray(err.errors)) {
        errorMessage = err.errors.join('. ');
      } else if (typeof err.errors === 'object') {
        const errorMessages = Object.values(err.errors).filter(Boolean);
        if (errorMessages.length > 0) errorMessage = errorMessages.join('. ');
      }
    }

    // Optional: let user specify skills if auto-infer failed
    if (typeof modal !== 'undefined') {
      const tryManual = await modal.confirm(
        `${errorMessage}\n\nEnter skills manually?`,
        'Send request'
      );
      if (!tryManual) {
        showAlert(errorMessage, 'error');
        return;
      }
      const offeredSkill = await modal.prompt(
        'Skill you are offering:',
        'Send Exchange Request',
        '',
        'e.g. Java'
      );
      if (!offeredSkill || !offeredSkill.trim()) return;
      const requestedSkill = await modal.prompt(
        'Skill you are requesting from them:',
        'Send Exchange Request',
        '',
        'e.g. Photoshop'
      );
      if (!requestedSkill || !requestedSkill.trim()) return;
      try {
        if (typeof loading !== 'undefined') restoreButton = loading.button(btn, 'Sending…');
        await sendExchangeRequest(userId, {
          offeredSkill: offeredSkill.trim(),
          requestedSkill: requestedSkill.trim()
        });
        markRequestSentForUser(userId);
        btn.disabled = true;
        btn.textContent = 'Sent';
        if (restoreButton) restoreButton();
        showAlert('Request sent successfully', 'success');
        if (document.getElementById('sentRequestsList')) loadRequestsSummary();
      } catch (err2) {
        if (restoreButton) restoreButton();
        showAlert(err2.message, 'error');
      }
      return;
    }

    showAlert(errorMessage, 'error');
  }
};

function bindSendRequestDelegation() {
  if (window.__skillBarterSendDelegation) return;
  window.__skillBarterSendDelegation = true;
  document.body.addEventListener('click', (e) => {
    const inArea = e.target.closest(
      '#browseUsersList, #matchedMutualList, #matchedPartialList, #discoveryUsers'
    );
    if (!inArea) return;
    const btn = e.target.closest('[data-action="send-request"]');
    if (!btn) return;
    e.preventDefault();
    handleSendRequestClick({ target: btn });
  });
}

function bindUserProfileDelegation() {
  if (window.__skillBarterProfileDelegation) return;
  window.__skillBarterProfileDelegation = true;
  document.body.addEventListener('click', (e) => {
    const inArea = e.target.closest('#discoveryUsers, #matchedMutualList, #matchedPartialList, #browseUsersList');
    if (!inArea) return;
    if (e.target.closest('button[data-action], a, input, select, textarea, label')) return;
    const card = e.target.closest('[data-user-id]');
    if (!card) return;
    const userId = card.getAttribute('data-user-id');
    if (!userId) return;
    e.preventDefault();
    goToUserProfile(userId);
  });
}

let chatPollTimer = null;

function chatSessionLabel(session, myIdStr) {
  const u1 = session.user1;
  const u2 = session.user2;
  const other = String(u1._id || u1) === myIdStr ? u2 : u1;
  return `${other?.name || 'Partner'} · ${session.status || 'ongoing'}`;
}

async function refreshChatSessionSelect() {
  const sel = document.getElementById('chatSessionSelect');
  if (!sel) return;
  try {
    const me = await authFetch(`${API_BASE}/api/users/me`);
    const myIdStr = String(me._id || me.id);
    const sessions = await authFetch(`${API_BASE}/api/sessions/me/overview`);
    const prev = sel.value;
    sel.innerHTML =
      '<option value="">Select an exchange…</option>' +
      sessions
        .map(
          (s) =>
            `<option value="${s._id}">${escapeHtml(chatSessionLabel(s, myIdStr))}</option>`
        )
        .join('');
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  } catch {
    /* non-fatal */
  }
}

async function loadChatMessages(sessionId) {
  const box = document.getElementById('chatMessages');
  if (!box || !sessionId) return;
  try {
    const msgs = await authFetch(`${API_BASE}/api/chat/${sessionId}`);
    if (!msgs.length) {
      box.innerHTML = '<p class="muted">No messages yet. Say hi or paste a Meet link.</p>';
      return;
    }
    box.innerHTML = msgs
      .map(
        (m) =>
          `<div class="chat-line"><span class="chat-sender">${escapeHtml(
            m.senderId?.name || 'User'
          )}</span><span class="chat-text">${escapeHtml(m.message)}</span></div>`
      )
      .join('');
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    box.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

function initDashboardChat() {
  if (window.__skillBarterChatInit) return;
  window.__skillBarterChatInit = true;

  const sel = document.getElementById('chatSessionSelect');
  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');
  if (!sel || !sendBtn || !input) return;

  sel.addEventListener('change', () => {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
    const id = sel.value;
    if (!id) {
      const box = document.getElementById('chatMessages');
      if (box) box.innerHTML = '';
      return;
    }
    loadChatMessages(id);
    chatPollTimer = setInterval(() => loadChatMessages(id), 5000);
  });

  const postMessage = async () => {
    const sessionId = sel.value;
    const message = input.value.trim();
    if (!sessionId || !message) return;
    try {
      await authFetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, message })
      });
      input.value = '';
      await loadChatMessages(sessionId);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  sendBtn.addEventListener('click', postMessage);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      postMessage();
    }
  });

  refreshChatSessionSelect();
}

const loadRequestsSummary = async (sentPage = 1, receivedPage = 1, statusFilter = '') => {
  const sentContainer = document.getElementById('sentRequestsList');
  const receivedContainer = document.getElementById('receivedRequestsList');
  if (!sentContainer || !receivedContainer) return;

  const restoreSent = typeof loading !== 'undefined'
    ? loading.inline(sentContainer, 'Loading sent requests...')
    : (() => { sentContainer.innerHTML = '<p class="muted">Loading...</p>'; return () => {}; })();
  const restoreReceived = typeof loading !== 'undefined'
    ? loading.inline(receivedContainer, 'Loading received requests...')
    : (() => { receivedContainer.innerHTML = '<p class="muted">Loading...</p>'; return () => {}; })();

  try {
    const sentParams = { page: sentPage, limit: 5 };
    const receivedParams = { page: receivedPage, limit: 5 };
    
    if (statusFilter) {
      sentParams.status = statusFilter;
      receivedParams.status = statusFilter;
    }

    const sentQuery = typeof paginationUtils !== 'undefined'
      ? paginationUtils.buildQueryString(sentParams)
      : Object.keys(sentParams).map(k => `${k}=${encodeURIComponent(sentParams[k])}`).join('&');
    
    const receivedQuery = typeof paginationUtils !== 'undefined'
      ? paginationUtils.buildQueryString(receivedParams)
      : Object.keys(receivedParams).map(k => `${k}=${encodeURIComponent(receivedParams[k])}`).join('&');

    const [sentResponse, receivedResponse] = await Promise.all([
      authFetch(`${API_BASE}/api/requests/sent${sentQuery ? '?' + sentQuery : ''}`),
      authFetch(`${API_BASE}/api/requests/received${receivedQuery ? '?' + receivedQuery : ''}`)
    ]);
    
    restoreSent();
    restoreReceived();

    const sent = sentResponse.data || sentResponse;
    const received = receivedResponse.data || receivedResponse;
    const sentPagination = sentResponse.pagination;
    const receivedPagination = receivedResponse.pagination;

    // fetch sessions for accepted requests
    const requestsToCheck = [];
    sent.forEach(r => { if (r.status === 'accepted') requestsToCheck.push(r); });
    received.forEach(r => { if (r.status === 'accepted') requestsToCheck.push(r); });

    const sessionsMap = {};
    await Promise.all(requestsToCheck.map(async (r) => {
      try {
        const sess = await authFetch(`${API_BASE}/api/sessions/${r._id}`);
        if (sess && sess._id) sessionsMap[r._id] = sess;
      } catch (e) {
        // ignore, maybe session not created yet
      }
    }));

    sentContainer.innerHTML = sent.length
      ? sent.map((r) => renderRequestCard(r, true, false, sessionsMap[r._id])).join('')
      : '<p class="muted">No sent requests yet.</p>';

    receivedContainer.innerHTML = received.length
      ? received.map((r) => renderRequestCard(r, false, true, sessionsMap[r._id])).join('')
      : '<p class="muted">No received requests yet.</p>';

    // Add pagination info if needed
    if (sentPagination && sentPagination.totalPages > 1) {
      const paginationHTML = `
        <div style="margin-top: 0.75rem; text-align: center; color: #9ca3af; font-size: 0.85rem;">
          Page ${sentPagination.page} of ${sentPagination.totalPages} (${sentPagination.total} total)
        </div>
      `;
      sentContainer.insertAdjacentHTML('beforeend', paginationHTML);
    }

    if (receivedPagination && receivedPagination.totalPages > 1) {
      const paginationHTML = `
        <div style="margin-top: 0.75rem; text-align: center; color: #9ca3af; font-size: 0.85rem;">
          Page ${receivedPagination.page} of ${receivedPagination.totalPages} (${receivedPagination.total} total)
        </div>
      `;
      receivedContainer.insertAdjacentHTML('beforeend', paginationHTML);
    }
  } catch (err) {
    restoreSent();
    restoreReceived();
    sentContainer.innerHTML = `<p class="muted">${err.message}</p>`;
    receivedContainer.innerHTML = `<p class="muted">${err.message}</p>`;
  }
};

const loadBrowseUsers = async (page = 1) => {
  bindSendRequestDelegation();
  const container = document.getElementById('browseUsersList');
  const paginationContainer = document.getElementById('browsePagination');
  if (!container) return;

  const restoreInline =
    typeof loading !== 'undefined'
      ? loading.inline(container, 'Loading users...')
      : (() => {
          container.innerHTML = '<p class="muted">Loading users...</p>';
          return () => {};
        })();

  const searchInput = document.getElementById('searchInput');
  const skillFilter = document.getElementById('skillFilter');
  const params = { page, limit: 10 };
  if (searchInput?.value?.trim()) params.search = searchInput.value.trim();
  if (skillFilter?.value?.trim()) params.skill = skillFilter.value.trim();

  const queryString =
    typeof paginationUtils !== 'undefined'
      ? paginationUtils.buildQueryString(params)
      : Object.keys(params)
          .map((k) => `${k}=${encodeURIComponent(params[k])}`)
          .join('&');

  try {
    await loadSentRequestTargetIds();
    const response = await authFetch(
      `${API_BASE}/api/users${queryString ? `?${queryString}` : ''}`
    );
    restoreInline();

    const users = Array.isArray(response.data) ? response.data : [];
    const pagination = response.pagination;

    if (!users.length) {
      container.innerHTML =
        '<p class="muted">No users match your filters. Try clearing search or browse again later.</p>';
      if (paginationContainer && typeof paginationUtils !== 'undefined') {
        paginationUtils.renderPagination(paginationContainer, pagination, () => {});
      } else if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    container.innerHTML = users
      .map((user) =>
        renderUserCard(
          user,
          `<button type="button" class="btn btn-small primary-btn" data-action="send-request" data-user-id="${user._id}" ${hasSentRequestToUser(user._id) ? 'disabled' : ''}>
            ${hasSentRequestToUser(user._id) ? 'Sent' : 'Send Request'}
          </button>`
        )
      )
      .join('');

    if (paginationContainer && pagination && typeof paginationUtils !== 'undefined') {
      paginationUtils.renderPagination(paginationContainer, pagination, (newPage) => {
        loadBrowseUsers(newPage);
      });
    } else if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
  } catch (err) {
    restoreInline();
    container.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
  }
};

const initBrowsePage = async () => {
  ensureUser();
  bindSendRequestDelegation();
  bindUserProfileDelegation();

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    clearAuth();
    window.location.href = 'index.html';
  });

  const searchInput = document.getElementById('searchInput');
  const skillFilter = document.getElementById('skillFilter');
  const clearBtn = document.getElementById('clearFiltersBtn');

  let debounceTimer;
  const scheduleReload = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadBrowseUsers(1), 350);
  };

  searchInput?.addEventListener('input', scheduleReload);
  skillFilter?.addEventListener('input', scheduleReload);
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (skillFilter) skillFilter.value = '';
    loadBrowseUsers(1);
  });

  await loadBrowseUsers(1);
};

const initRequestsPage = async () => {
  ensureUser();

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    clearAuth();
    window.location.href = 'index.html';
  });

  bindRequestListsDelegation();
  await loadRequestsSummary();
};

const handleRequestActionClick = async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  if (action !== 'accept' && action !== 'reject') return;

  const id = btn.getAttribute('data-request-id');

  if (!id) return;

  const endpoint =
    action === 'accept'
      ? `${API_BASE}/api/requests/${id}/accept`
      : `${API_BASE}/api/requests/${id}/reject`;

  let restoreButton = null;
  try {
    if (typeof loading !== 'undefined') {
      restoreButton = loading.button(btn, 'Processing...');
    }
    // Accept uses PUT; reject stays PATCH. Authorization: Bearer <token> is set in authFetch.
    await authFetch(endpoint, { method: action === 'accept' ? 'PUT' : 'PATCH' });
    await loadRequestsSummary();
    await loadSessionsOverview();
    showAlert(`Request ${action === 'accept' ? 'accepted' : 'rejected'} successfully`, 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  } finally {
    if (restoreButton) restoreButton();
  }
};

const handleSessionActionClick = async (e) => {
  const btn = e.target.closest('button[data-action="complete-session"]');
  if (!btn) return;
  const sessionId = btn.getAttribute('data-session-id');
  if (!sessionId) return;

  let restore = null;
  try {
    if (typeof loading !== 'undefined') {
      restore = loading.button(btn, 'Updating...');
    }
    await authFetch(`${API_BASE}/api/sessions/${sessionId}/complete`, { method: 'PUT' });
    await loadRequestsSummary();
    await loadSessionsOverview();
    showAlert('Session progress updated', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  } finally {
    if (restore) restore();
  }
};

const handleProofUploadClick = async (e) => {
  const btn = e.target.closest('button[data-action="upload-proof"]');
  if (!btn) return;
  const sessionId = btn.getAttribute('data-session-id');
  if (!sessionId) return;
  const input = document.querySelector(`input[data-proof-input="${sessionId}"]`);
  const file = input?.files?.[0];
  if (!file) {
    showAlert('Select a proof file first', 'warning');
    return;
  }
  const formData = new FormData();
  formData.append('proof', file);
  let restore = null;
  try {
    if (typeof loading !== 'undefined') restore = loading.button(btn, 'Uploading...');
    await authFetchForm(`${API_BASE}/api/sessions/${sessionId}/upload-proof`, {
      method: 'POST',
      body: formData
    });
    if (restore) restore();
    showAlert('Proof uploaded successfully', 'success');
    await loadSessionsOverview();
  } catch (err) {
    if (restore) restore();
    showAlert(err.message, 'error');
  }
};

const handleSubmitRatingClick = async (e) => {
  const btn = e.target.closest('button[data-action="submit-rating"]');
  if (!btn) return;
  const sessionId = btn.getAttribute('data-session-id');
  const toUser = btn.getAttribute('data-to-user-id');
  const ratingEl = document.querySelector(`select[data-rating-value="${sessionId}"]`);
  const hiddenRatingEl = document.querySelector(`input[data-rating-stars-value="${sessionId}"]`);
  const feedbackEl = document.querySelector(`input[data-rating-feedback="${sessionId}"]`);
  const rating = Number(hiddenRatingEl?.value || ratingEl?.value);
  const feedback = feedbackEl?.value?.trim() || '';
  if (!rating) {
    showAlert('Select rating between 1 and 5', 'warning');
    return;
  }
  let restore = null;
  try {
    if (typeof loading !== 'undefined') restore = loading.button(btn, 'Submitting...');
    await authFetch(`${API_BASE}/api/ratings`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, toUser, rating, feedback })
    });
    if (restore) restore();
    showAlert('Rating submitted', 'success');
    btn.disabled = true;
    if (feedbackEl) feedbackEl.disabled = true;
    if (ratingEl) ratingEl.disabled = true;
    if (hiddenRatingEl) hiddenRatingEl.disabled = true;
    const starBtns = document.querySelectorAll(`button[data-action="set-rating-star"][data-session-id="${sessionId}"]`);
    starBtns.forEach((b) => {
      b.disabled = true;
      b.style.opacity = '0.7';
    });
  } catch (err) {
    if (restore) restore();
    showAlert(err.message, 'error');
  }
};

/** Single delegated listener — avoids duplicate handlers when lists re-render */
function bindRequestListsDelegation() {
  if (window.__skillBarterRequestDelegation) return;
  window.__skillBarterRequestDelegation = true;
  document.body.addEventListener('click', (e) => {
    const inArea = e.target.closest(
      '#sentRequestsList, #receivedRequestsList, #sessionsOverview'
    );
    if (!inArea) return;
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'complete-session') {
      e.preventDefault();
      handleSessionActionClick({ target: btn });
      return;
    }
    if (action === 'upload-proof') {
      e.preventDefault();
      handleProofUploadClick({ target: btn });
      return;
    }
    if (action === 'submit-rating') {
      e.preventDefault();
      handleSubmitRatingClick({ target: btn });
      return;
    }
    if (action === 'set-rating-star') {
      e.preventDefault();
      const sessionId = btn.getAttribute('data-session-id');
      const value = Number(btn.getAttribute('data-star-value'));
      if (!sessionId || !Number.isFinite(value) || value < 1 || value > 5) return;
      const hidden = document.querySelector(`input[data-rating-stars-value="${sessionId}"]`);
      if (hidden) hidden.value = String(value);
      const stars = document.querySelectorAll(`button[data-action="set-rating-star"][data-session-id="${sessionId}"]`);
      stars.forEach((s) => {
        const v = Number(s.getAttribute('data-star-value'));
        s.textContent = v <= value ? '★' : '☆';
      });
      return;
    }
    if (action === 'accept' || action === 'reject') {
      e.preventDefault();
      handleRequestActionClick({ target: btn });
    }
  });
}

function renderSessionOverviewCard(session, myIdStr, myRatingsMap = {}) {
  const u1 = session.user1;
  const u2 = session.user2;
  const other =
    String(u1._id || u1) === myIdStr ? u2 : u1;
  const otherName = other?.name || 'Partner';
  const pct = session.progressPercentage ?? 0;
  const req = session.requestId;
  const otherId = String(u1._id || u1) === myIdStr ? String(u2._id || u2) : String(u1._id || u1);
  const skillLine =
    req && req.offeredSkill
      ? `${req.offeredSkill} ↔ ${req.requestedSkill || ''}`
      : 'Skill exchange';
  const existingRating = myRatingsMap[String(session._id)] || null;
  const existingValue = existingRating ? Number(existingRating.rating || 0) : 0;

  return `
    <div class="list-item session-overview-card">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">With ${otherName}</div>
          <div class="list-item-subtitle">${skillLine}</div>
        </div>
        <span class="tag ${session.status === 'completed' ? 'status-accepted' : 'status-pending'}">${session.status}</span>
      </div>
      <div class="progress-row">
        <div class="progress-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="progress-text">${pct}%</span>
      </div>
      <div class="session-count muted">${session.completedSessions} / ${session.totalSessions} micro-sessions</div>
      <div class="session-proof muted">
        ${
          session.proofUpload
            ? `Proof uploaded: <a href="${API_BASE}${session.proofUpload}" target="_blank" rel="noopener noreferrer">View</a>`
            : 'Proof required before completion'
        }
      </div>
      ${
        session.status !== 'completed'
          ? `<div class="session-proof-upload">
              <input type="file" data-proof-input="${session._id}" accept=".pdf,.jpg,.jpeg,.png,.webp" />
              <button type="button" class="btn btn-small secondary-btn" data-action="upload-proof" data-session-id="${session._id}">Upload Proof</button>
            </div>`
          : ''
      }
      ${
        session.status !== 'completed'
          ? `<button type="button" class="btn btn-small primary-btn" data-action="complete-session" data-session-id="${session._id}" ${session.proofUpload ? '' : 'disabled'}>Mark session complete</button>`
          : `<div class="session-rating-block">
              <div class="muted">Rate your partner</div>
              <div style="display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;">
                <button type="button" class="btn btn-small secondary-btn" data-action="set-rating-star" data-session-id="${session._id}" data-star-value="1" ${existingRating ? 'disabled' : ''}>${existingValue >= 1 ? '★' : '☆'}</button>
                <button type="button" class="btn btn-small secondary-btn" data-action="set-rating-star" data-session-id="${session._id}" data-star-value="2" ${existingRating ? 'disabled' : ''}>${existingValue >= 2 ? '★' : '☆'}</button>
                <button type="button" class="btn btn-small secondary-btn" data-action="set-rating-star" data-session-id="${session._id}" data-star-value="3" ${existingRating ? 'disabled' : ''}>${existingValue >= 3 ? '★' : '☆'}</button>
                <button type="button" class="btn btn-small secondary-btn" data-action="set-rating-star" data-session-id="${session._id}" data-star-value="4" ${existingRating ? 'disabled' : ''}>${existingValue >= 4 ? '★' : '☆'}</button>
                <button type="button" class="btn btn-small secondary-btn" data-action="set-rating-star" data-session-id="${session._id}" data-star-value="5" ${existingRating ? 'disabled' : ''}>${existingValue >= 5 ? '★' : '☆'}</button>
              </div>
              <input type="hidden" data-rating-stars-value="${session._id}" value="${existingValue || ''}" ${existingRating ? 'disabled' : ''} />
              <select data-rating-value="${session._id}" class="filter-select" style="display:none;">
                <option value="">Select rating</option>
              </select>
              <input type="text" class="search-input" data-rating-feedback="${session._id}" placeholder="Optional feedback" value="${escapeAttr(existingRating?.feedback || '')}" ${existingRating ? 'disabled' : ''} />
              <button type="button" class="btn btn-small primary-btn" data-action="submit-rating" data-session-id="${session._id}" data-to-user-id="${otherId}" ${existingRating ? 'disabled' : ''}>${existingRating ? 'Already Rated' : 'Submit Rating'}</button>
            </div>`
      }
    </div>
  `;
}

const loadSessionsOverview = async () => {
  const el = document.getElementById('sessionsOverview');

  try {
    if (el) {
      const me = await authFetch(`${API_BASE}/api/users/me`);
      const myIdStr = String(me._id || me.id);
      const sessions = await authFetch(`${API_BASE}/api/sessions/me/overview`);
      const completedSessionIds = sessions
        .filter((s) => s && s.status === 'completed' && s._id)
        .map((s) => String(s._id));
      let myRatingsMap = {};
      if (completedSessionIds.length) {
        try {
          const myRatings = await authFetch(
            `${API_BASE}/api/ratings/me?sessionIds=${encodeURIComponent(completedSessionIds.join(','))}`
          );
          myRatingsMap = (Array.isArray(myRatings) ? myRatings : []).reduce((acc, r) => {
            acc[String(r.sessionId)] = r;
            return acc;
          }, {});
        } catch {
          myRatingsMap = {};
        }
      }

      if (!sessions.length) {
        el.innerHTML =
          '<p class="muted">No active learning exchanges yet. When someone accepts your request (or you accept theirs), progress will appear here.</p>';
      } else {
        el.innerHTML = `<div class="list">${sessions.map((s) => renderSessionOverviewCard(s, myIdStr, myRatingsMap)).join('')}</div>`;
      }
    }
  } catch (err) {
    if (el) el.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  } finally {
    await refreshChatSessionSelect();
  }
};

const initAdminPage = async () => {
  ensureAdmin();

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    clearAuth();
    window.location.href = 'index.html';
  });

  // Pagination state
  let usersPage = 1;
  let requestsPage = 1;
  let userSearch = '';
  let userRoleFilter = '';
  let userBlockedFilter = '';
  let requestStatusFilter = '';

  const userSearchInput = document.getElementById('adminUserSearch');
  const userRoleFilterSelect = document.getElementById('adminUserRoleFilter');
  const userBlockedFilterSelect = document.getElementById('adminUserBlockedFilter');
  const requestStatusFilterSelect = document.getElementById('adminRequestStatusFilter');
  const usersPaginationContainer = document.getElementById('adminUsersPagination');
  const requestsPaginationContainer = document.getElementById('adminRequestsPagination');

  // User search handler (debounced)
  let userSearchTimeout;
  if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
      clearTimeout(userSearchTimeout);
      userSearch = e.target.value;
      usersPage = 1;
      userSearchTimeout = setTimeout(() => {
        loadAdminUsers(usersPage, userSearch, userRoleFilter, userBlockedFilter);
      }, 500);
    });
  }

  // User filter handlers
  if (userRoleFilterSelect) {
    userRoleFilterSelect.addEventListener('change', (e) => {
      userRoleFilter = e.target.value;
      usersPage = 1;
      loadAdminUsers(usersPage, userSearch, userRoleFilter, userBlockedFilter);
    });
  }

  if (userBlockedFilterSelect) {
    userBlockedFilterSelect.addEventListener('change', (e) => {
      userBlockedFilter = e.target.value;
      usersPage = 1;
      loadAdminUsers(usersPage, userSearch, userRoleFilter, userBlockedFilter);
    });
  }

  // Request filter handler
  if (requestStatusFilterSelect) {
    requestStatusFilterSelect.addEventListener('change', (e) => {
      requestStatusFilter = e.target.value;
      requestsPage = 1;
      loadAdminRequests(requestsPage, requestStatusFilter);
    });
  }

  await loadAdminStats();
  await loadAdminUsers(usersPage, userSearch, userRoleFilter, userBlockedFilter);
  await loadAdminRequests(requestsPage, requestStatusFilter);
};

const loadAdminStats = async () => {
  try {
    const stats = await authFetch(`${API_BASE}/api/admin/stats`);
    document.getElementById('statTotalUsers').textContent = stats.totalUsers ?? 0;
    document.getElementById('statTotalRequests').textContent = stats.totalRequests ?? 0;
    document.getElementById('statAcceptedRequests').textContent = stats.acceptedRequests ?? 0;
    document.getElementById('statRejectedRequests').textContent = stats.rejectedRequests ?? 0;
  } catch (err) {
    console.error(err);
  }
};

const loadAdminUsers = async (page = 1, search = '', role = '', isBlocked = '') => {
  const tbody = document.getElementById('adminUsersTableBody');
  const paginationContainer = document.getElementById('adminUsersPagination');
  
  tbody.innerHTML = '<tr><td colspan="6">Loading users...</td></tr>';

  try {
    const params = { page, limit: 10 };
    if (search.trim()) params.search = search.trim();
    if (role) params.role = role;
    if (isBlocked !== '') params.isBlocked = isBlocked;

    const queryString = typeof paginationUtils !== 'undefined'
      ? paginationUtils.buildQueryString(params)
      : Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

    const response = await authFetch(`${API_BASE}/api/admin/users${queryString ? '?' + queryString : ''}`);
    
    const users = response.data || response;
    const pagination = response.pagination;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
      if (paginationContainer && typeof paginationUtils !== 'undefined') {
        paginationUtils.renderPagination(paginationContainer, pagination, (newPage) => {
          loadAdminUsers(newPage, search, role, isBlocked);
        });
      }
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.isBlocked ? 'Yes' : 'No'}</td>
        <td>
          <div class="muted" style="display:flex;flex-direction:column;gap:0.25rem;">
            <span class="tag ${verificationStatusClass(u.verificationStatus || 'rejected')}">${verificationStatusLabel(u.verificationStatus)}</span>
            ${u.verificationProof ? `<a href="${escapeAttr(resolveUploadUrl(u.verificationProof))}" target="_blank" rel="noopener noreferrer">Proof</a>` : '<span class="muted">No proof</span>'}
          </div>
        </td>
        <td>
          ${
            u.verificationStatus === 'pending'
              ? `<button class="btn btn-small primary-btn" data-action="approve-verification" data-user-id="${u._id}">Accept</button>
                 <button class="btn btn-small secondary-btn" data-action="reject-verification" data-user-id="${u._id}">Reject</button>`
              : ''
          }
          <button class="btn btn-small secondary-btn" data-action="toggle-block" data-user-id="${u._id}">
            ${u.isBlocked ? 'Unblock' : 'Block'}
          </button>
          <button class="btn btn-small danger-btn" data-action="delete-user" data-user-id="${u._id}">
            Delete
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    tbody.addEventListener('click', handleAdminUserActionClick);

    // Render pagination
    if (paginationContainer && pagination && typeof paginationUtils !== 'undefined') {
      paginationUtils.renderPagination(paginationContainer, pagination, (newPage) => {
        loadAdminUsers(newPage, search, role, isBlocked);
      });
    } else if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
  }
};

const handleAdminUserActionClick = async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const userId = btn.getAttribute('data-user-id');

  if (action === 'delete-user') {
    const confirmed = typeof modal !== 'undefined'
      ? await modal.confirm('Delete this user and their related requests?', 'Delete User')
      : confirm('Delete this user and their related requests?');
    
    if (!confirmed) return;
    
    try {
      const restoreButton = loading.button(btn, 'Deleting...');
      await authFetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE' });
      restoreButton();
      // Reload with current filters
      const userSearchInput = document.getElementById('adminUserSearch');
      const userRoleFilterSelect = document.getElementById('adminUserRoleFilter');
      const userBlockedFilterSelect = document.getElementById('adminUserBlockedFilter');
      const currentPage = 1; // Reset to first page after delete
      loadAdminUsers(currentPage, userSearchInput?.value || '', userRoleFilterSelect?.value || '', userBlockedFilterSelect?.value || '');
      await loadAdminStats();
      showAlert('User deleted successfully', 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    }
  } else if (action === 'toggle-block') {
    const isBlocked = btn.textContent.includes('Unblock');
    const actionText = isBlocked ? 'unblock' : 'block';
    const confirmed = typeof modal !== 'undefined'
      ? await modal.confirm(`Are you sure you want to ${actionText} this user?`, `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`)
      : confirm(`Are you sure you want to ${actionText} this user?`);
    
    if (!confirmed) return;
    
    const endpoint = isBlocked
      ? `${API_BASE}/api/admin/users/${userId}/unblock`
      : `${API_BASE}/api/admin/users/${userId}/block`;
    try {
      const restoreButton = loading.button(btn, 'Processing...');
      await authFetch(endpoint, { method: 'PATCH' });
      restoreButton();
      // Reload with current filters
      const userSearchInput = document.getElementById('adminUserSearch');
      const userRoleFilterSelect = document.getElementById('adminUserRoleFilter');
      const userBlockedFilterSelect = document.getElementById('adminUserBlockedFilter');
      const currentPage = 1; // Reset to first page after action
      loadAdminUsers(currentPage, userSearchInput?.value || '', userRoleFilterSelect?.value || '', userBlockedFilterSelect?.value || '');
      showAlert(`User ${actionText}ed successfully`, 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    }
  } else if (action === 'approve-verification' || action === 'reject-verification') {
    const approve = action === 'approve-verification';
    try {
      const restoreButton = loading.button(btn, approve ? 'Approving...' : 'Rejecting...');
      await authFetch(`${API_BASE}/api/admin/verify/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: approve ? 'approved' : 'rejected' })
      });
      restoreButton();
      const userSearchInput = document.getElementById('adminUserSearch');
      const userRoleFilterSelect = document.getElementById('adminUserRoleFilter');
      const userBlockedFilterSelect = document.getElementById('adminUserBlockedFilter');
      loadAdminUsers(
        1,
        userSearchInput?.value || '',
        userRoleFilterSelect?.value || '',
        userBlockedFilterSelect?.value || ''
      );
      showAlert(`Verification ${approve ? 'approved' : 'rejected'}`, 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }
};

const loadAdminRequests = async (page = 1, status = '') => {
  const tbody = document.getElementById('adminRequestsTableBody');
  const paginationContainer = document.getElementById('adminRequestsPagination');
  
  tbody.innerHTML = '<tr><td colspan="7">Loading requests...</td></tr>';

  try {
    const params = { page, limit: 10 };
    if (status) params.status = status;

    const queryString = typeof paginationUtils !== 'undefined'
      ? paginationUtils.buildQueryString(params)
      : Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

    const response = await authFetch(`${API_BASE}/api/admin/requests${queryString ? '?' + queryString : ''}`);
    
    const requests = response.data || response;
    const pagination = response.pagination;

    if (!requests.length) {
      tbody.innerHTML = '<tr><td colspan="7">No requests found.</td></tr>';
      if (paginationContainer && typeof paginationUtils !== 'undefined') {
        paginationUtils.renderPagination(paginationContainer, pagination, (newPage) => {
          loadAdminRequests(newPage, status);
        });
      }
      return;
    }

    tbody.innerHTML = requests
      .map(
        (r) => `
      <tr>
        <td>${r.fromUser?.name || '-'}</td>
        <td>${r.toUser?.name || '-'}</td>
        <td>${r.offeredSkill}</td>
        <td>${r.requestedSkill}</td>
        <td>${r.status}</td>
        <td>${new Date(r.createdAt).toLocaleString()}</td>
        <td>
          <button class="btn btn-small danger-btn" data-action="delete-request" data-request-id="${r._id}">
            Delete
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    tbody.addEventListener('click', handleAdminRequestActionClick);

    // Render pagination
    if (paginationContainer && pagination && typeof paginationUtils !== 'undefined') {
      paginationUtils.renderPagination(paginationContainer, pagination, (newPage) => {
        loadAdminRequests(newPage, status);
      });
    } else if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
  }
};

const handleAdminRequestActionClick = async (e) => {
  const btn = e.target.closest('button[data-action="delete-request"]');
  if (!btn) return;

  const id = btn.getAttribute('data-request-id');
  const confirmed = typeof modal !== 'undefined'
    ? await modal.confirm('Delete this exchange request?', 'Delete Request')
    : confirm('Delete this exchange request?');
  
  if (!confirmed) return;

  try {
    const restoreButton = loading.button(btn, 'Deleting...');
    await authFetch(`${API_BASE}/api/admin/requests/${id}`, { method: 'DELETE' });
    restoreButton();
    // Reload with current filter
    const requestStatusFilterSelect = document.getElementById('adminRequestStatusFilter');
    const currentPage = 1; // Reset to first page after delete
    loadAdminRequests(currentPage, requestStatusFilterSelect?.value || '');
    await loadAdminStats();
    showAlert('Request deleted successfully', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page');

  switch (page) {
    case 'login':
      initLoginPage();
      break;
    case 'register':
      initRegisterPage();
      break;
    case 'dashboard':
      initDashboardPage();
      break;
    case 'browse':
      initBrowsePage();
      break;
    case 'requests':
      initRequestsPage();
      break;
    case 'admin':
      initAdminPage();
      break;
    default:
      break;
  }
});


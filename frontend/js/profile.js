(() => {
  const el = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof getToken === 'function' && !getToken()) {
      window.location.href = 'index.html';
      return;
    }

    el('logoutBtn')?.addEventListener('click', () => {
      clearAuth();
      window.location.href = 'index.html';
    });

    // Reuse existing dashboard initializer logic safely by calling the parts we need.
    // We intentionally avoid calling initDashboardPage() to keep pages separated.
    (async () => {
      try {
        const user = await authFetch(`${API_BASE}/api/users/me`);

        const img = el('profilePhotoImg');
        if (img) {
          const src =
            typeof resolveProfilePictureSrc === 'function'
              ? resolveProfilePictureSrc(user.profilePicture)
              : user.profilePicture
                ? `${API_BASE}${String(user.profilePicture)}`
                : (window.SKILLBARTER_DEFAULT_AVATAR || '');
          img.src = src;
          img.onerror = () => {
            img.onerror = null;
            img.src = window.SKILLBARTER_DEFAULT_AVATAR || '';
          };
        }

        el('profileName').textContent = user.name || '';
        el('profileEmail').textContent = user.email || '';
        if (el('profileAge')) el('profileAge').textContent = user.age ? String(user.age) : '—';
        if (el('profilePreference')) el('profilePreference').textContent = user.learningPreference || 'both';

        el('profileBio').textContent = user.bio || 'No bio yet';
        el('profileSkillsOffered').textContent = formatSkills(user.skillsOffered);
        el('profileSkillsWanted').textContent = formatSkills(user.skillsWanted);

        if (el('bio')) el('bio').value = user.bio || '';
        if (el('skillsOffered')) el('skillsOffered').value = (user.skillsOffered || []).join(', ');
        if (el('skillsWanted')) el('skillsWanted').value = (user.skillsWanted || []).join(', ');
        if (el('age')) el('age').value = user.age || '';
        if (el('learningPreference')) el('learningPreference').value = user.learningPreference || 'both';

        const statusEl = el('profileVerificationStatus');
        if (statusEl) {
          const st = user.verificationStatus || 'rejected';
          statusEl.className = `tag ${verificationStatusClass(st)}`;
          statusEl.textContent = st;
        }
        const proofEl = el('verificationProofLink');
        if (proofEl) {
          proofEl.innerHTML = user.verificationProof
            ? `Proof: <a href="${API_BASE}${user.verificationProof}" target="_blank" rel="noopener noreferrer">View uploaded file</a>`
            : 'Proof: Not uploaded';
        }

        if (el('profileAverageRating')) el('profileAverageRating').textContent = Number(user.averageRating || 0).toFixed(1);
        if (el('profileRatingCount')) el('profileRatingCount').textContent = String(user.ratingCount || 0);
        if (typeof loadProfileRatings === 'function') loadProfileRatings(user._id || user.id);
      } catch (err) {
        showAlert(err.message, 'error');
      }
    })();

    const photoForm = el('profilePhotoForm');
    photoForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = el('profilePhotoFile');
      const file = fileInput?.files?.[0];
      if (!file) {
        showAlert('Select a profile photo first', 'warning');
        return;
      }
      const okTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      if (!okTypes.has(file.type)) {
        showAlert('Only JPG, PNG, or WEBP images are allowed', 'warning');
        return;
      }
      const formData = new FormData();
      formData.append('photo', file);
      const submitBtn = photoForm.querySelector('button[type="submit"]');
      const restore = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Uploading...') : null;
      try {
        const resp = await authFetchForm(`${API_BASE}/api/users/upload-profile-photo`, {
          method: 'POST',
          body: formData
        });
        if (restore) restore();
        showAlert(resp.message || 'Profile photo updated', 'success');
        const img = el('profilePhotoImg');
        const u = resp.user || {};
        if (img) {
          img.src = typeof resolveProfilePictureSrc === 'function'
            ? resolveProfilePictureSrc(u.profilePicture)
            : (u.profilePicture ? `${API_BASE}${String(u.profilePicture)}` : (window.SKILLBARTER_DEFAULT_AVATAR || ''));
        }
        if (fileInput) fileInput.value = '';
      } catch (err) {
        if (restore) restore();
        showAlert(err.message, 'error');
      }
    });

    const profileForm = el('profileForm');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bio = el('bio').value.trim();
      const skillsOffered = parseSkills(el('skillsOffered').value);
      const skillsWanted = parseSkills(el('skillsWanted').value);
      const age = el('age')?.value ? Number(el('age').value) : undefined;
      const learningPreference = el('learningPreference')?.value || 'both';

      const submitBtn = profileForm.querySelector('button[type="submit"]');
      const restore = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Saving...') : null;

      try {
        const payload = { bio, skillsOffered, skillsWanted, learningPreference };
        if (Number.isFinite(age)) payload.age = age;
        const resp = await authFetch(`${API_BASE}/api/users/me`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (restore) restore();
        showAlert('Profile updated', 'success');
        const u = resp.user;
        el('profileBio').textContent = u.bio || 'No bio yet';
        el('profileSkillsOffered').textContent = formatSkills(u.skillsOffered);
        el('profileSkillsWanted').textContent = formatSkills(u.skillsWanted);
        if (el('profileAge')) el('profileAge').textContent = u.age ? String(u.age) : '—';
        if (el('profilePreference')) el('profilePreference').textContent = u.learningPreference || 'both';
      } catch (err) {
        if (restore) restore();
        showAlert(err.message, 'error');
      }
    });

    const verificationForm = el('verificationForm');
    verificationForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = el('verificationFile');
      const file = fileInput?.files?.[0];
      if (!file) {
        showAlert('Select a proof file first', 'warning');
        return;
      }
      const formData = new FormData();
      formData.append('proof', file);
      const submitBtn = verificationForm.querySelector('button[type="submit"]');
      const restore = typeof loading !== 'undefined' ? loading.button(submitBtn, 'Uploading...') : null;
      try {
        const resp = await authFetchForm(`${API_BASE}/api/users/upload-verification`, {
          method: 'POST',
          body: formData
        });
        if (restore) restore();
        showAlert(resp.message || 'Uploaded', 'success');
        const u = resp.user || {};
        const statusEl = el('profileVerificationStatus');
        if (statusEl) {
          statusEl.className = `tag ${verificationStatusClass(u.verificationStatus || 'pending')}`;
          statusEl.textContent = u.verificationStatus || 'pending';
        }
        const proofEl = el('verificationProofLink');
        if (proofEl && u.verificationProof) {
          proofEl.innerHTML = `Proof: <a href="${API_BASE}${u.verificationProof}" target="_blank" rel="noopener noreferrer">View uploaded file</a>`;
        }
      } catch (err) {
        if (restore) restore();
        showAlert(err.message, 'error');
      }
    });
  });
})();


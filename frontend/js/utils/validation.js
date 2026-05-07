/**
 * Frontend Validation Utilities
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return {
      valid: false,
      error: 'Email is required'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return {
      valid: false,
      error: 'Invalid email format'
    };
  }

  return {
    valid: true
  };
};

/**
 * Validate password
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
const validatePassword = (password) => {
  if (!password || password.length === 0) {
    return {
      valid: false,
      error: 'Password is required'
    };
  }

  if (password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters'
    };
  }

  return {
    valid: true
  };
};

/**
 * Validate name
 * @param {string} name - Name to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Name is required'
    };
  }

  return {
    valid: true
  };
};

/**
 * Show validation errors on form fields
 * @param {HTMLElement} form - Form element
 * @param {Object} errors - Object with field names as keys and error messages as values
 */
const showFormErrors = (form, errors) => {
  // Clear previous errors
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('.field-error-input').forEach((el) => el.classList.remove('field-error-input'));

  // Show new errors
  Object.keys(errors).forEach((fieldName) => {
    const errorMessage = errors[fieldName];
    if (!errorMessage) return;

    const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (field) {
      field.classList.add('field-error-input');
      const errorEl = document.createElement('div');
      errorEl.className = 'field-error';
      errorEl.textContent = errorMessage;
      field.parentElement.appendChild(errorEl);
    }
  });
};

/**
 * Clear form errors
 * @param {HTMLElement} form - Form element
 */
const clearFormErrors = (form) => {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('.field-error-input').forEach((el) => el.classList.remove('field-error-input'));
};

// Export for use in other files
if (typeof window !== 'undefined') {
  window.validationUtils = {
    validateEmail,
    validatePassword,
    validateName,
    showFormErrors,
    clearFormErrors
  };
}

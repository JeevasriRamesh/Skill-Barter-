/**
 * Email Validation Utility
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate email and return error message if invalid
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

  if (!isValidEmail(email)) {
    return {
      valid: false,
      error: 'Invalid email format'
    };
  }

  return {
    valid: true
  };
};

module.exports = {
  isValidEmail,
  validateEmail
};

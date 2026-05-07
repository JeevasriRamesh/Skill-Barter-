/**
 * Loading Spinner Utility
 * Provides loading states for async operations
 */

class Loading {
  constructor() {
    this.loaders = new Map();
  }

  /**
   * Show loading spinner on an element
   * @param {HTMLElement|string} element - Element or selector to show loader on
   * @param {string} message - Optional loading message
   * @returns {string} - Loader ID for later removal
   */
  show(element, message = 'Loading...') {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return null;

    const loaderId = `loader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create loader overlay
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.id = loaderId;
    loader.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        ${message ? `<p class="loading-message">${this.escapeHtml(message)}</p>` : ''}
      </div>
    `;

    // Make parent relative if not already
    const position = window.getComputedStyle(el).position;
    if (position === 'static') {
      el.style.position = 'relative';
    }

    // Append loader
    el.appendChild(loader);
    this.loaders.set(loaderId, { element: el, loader });

    // Trigger animation
    setTimeout(() => {
      loader.classList.add('loading-show');
    }, 10);

    return loaderId;
  }

  /**
   * Hide loading spinner
   * @param {string} loaderId - Loader ID returned from show()
   */
  hide(loaderId) {
    const loaderData = this.loaders.get(loaderId);
    if (!loaderData) return;

    const { loader } = loaderData;
    loader.classList.remove('loading-show');
    loader.classList.add('loading-hide');

    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
      this.loaders.delete(loaderId);
    }, 300);
  }

  /**
   * Show loading on button
   * @param {HTMLElement|string} button - Button element or selector
   * @param {string} loadingText - Text to show while loading
   * @returns {Function} - Function to call to restore button
   */
  button(button, loadingText = 'Loading...') {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    if (!btn) return () => {};

    const originalText = btn.textContent;
    const originalDisabled = btn.disabled;

    btn.disabled = true;
    btn.textContent = loadingText;
    btn.classList.add('btn-loading');

    return () => {
      btn.disabled = originalDisabled;
      btn.textContent = originalText;
      btn.classList.remove('btn-loading');
    };
  }

  /**
   * Show inline loading text
   * @param {HTMLElement|string} element - Element to show loading in
   * @param {string} message - Loading message
   * @returns {Function} - Function to restore original content
   */
  inline(element, message = 'Loading...') {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return () => {};

    const originalContent = el.innerHTML;
    el.innerHTML = `<span class="loading-inline">${this.escapeHtml(message)}</span>`;

    return () => {
      el.innerHTML = originalContent;
    };
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create singleton instance
const loading = new Loading();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = loading;
}

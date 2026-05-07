/**
 * Modal Component System
 * Replaces prompt() and confirm() with modern modal dialogs
 */

class Modal {
  constructor() {
    this.currentModal = null;
    this.init();
  }

  init() {
    // Create modal backdrop if it doesn't exist
    if (!document.getElementById('modal-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'modal-backdrop';
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
  }

  /**
   * Show a confirmation modal (replaces confirm())
   * @param {string} message - The message to display
   * @param {string} title - Modal title
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = this.createModal({
        title,
        message,
        showCancel: true,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {
          this.close();
          resolve(true);
        },
        onCancel: () => {
          this.close();
          resolve(false);
        }
      });
      this.show(modal);
    });
  }

  /**
   * Show a prompt modal (replaces prompt())
   * @param {string} message - The message to display
   * @param {string} title - Modal title
   * @param {string} defaultValue - Default input value
   * @param {string} placeholder - Input placeholder
   * @returns {Promise<string|null>} - Resolves to input value or null if cancelled
   */
  prompt(message, title = 'Input', defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
      const modal = this.createModal({
        title,
        message,
        showInput: true,
        inputValue: defaultValue,
        inputPlaceholder: placeholder,
        showCancel: true,
        confirmText: 'Submit',
        cancelText: 'Cancel',
        onConfirm: (inputValue) => {
          this.close();
          resolve(inputValue || null);
        },
        onCancel: () => {
          this.close();
          resolve(null);
        }
      });
      this.show(modal);
    });
  }

  /**
   * Show a choice modal (radio-style) and return selected value.
   * @param {string} message - Prompt text
   * @param {{value:string,label:string}[]} options - Choice options
   * @param {string} title - Modal title
   * @param {string} defaultValue - Default selected option value
   * @returns {Promise<string|null>}
   */
  choice(message, options = [], title = 'Choose', defaultValue = '') {
    return new Promise((resolve) => {
      const safeOptions = Array.isArray(options) ? options : [];
      const groupId = `modal-choice-${Date.now()}`;
      const renderedOptions = safeOptions
        .map((opt, idx) => {
          const v = String(opt?.value ?? '');
          const label = String(opt?.label ?? v);
          const checked = defaultValue
            ? v === defaultValue
            : idx === 0;
          return `
            <label class="modal-choice-row" style="display:flex;align-items:center;gap:0.5rem;margin:0.35rem 0;">
              <input type="radio" name="${this.escapeHtml(groupId)}" value="${this.escapeHtml(v)}" ${checked ? 'checked' : ''} />
              <span>${this.escapeHtml(label)}</span>
            </label>
          `;
        })
        .join('');

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${this.escapeHtml(title)}</h3>
            <button class="modal-close" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            ${message ? `<p class="modal-message">${this.escapeHtml(message)}</p>` : ''}
            <div class="modal-choice-group" role="radiogroup" aria-label="${this.escapeHtml(title)}">
              ${renderedOptions}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary-btn modal-btn-cancel">Cancel</button>
            <button class="btn primary-btn modal-btn-confirm">Continue</button>
          </div>
        </div>
      `;

      const closeBtn = modal.querySelector('.modal-close');
      const cancelBtn = modal.querySelector('.modal-btn-cancel');
      const confirmBtn = modal.querySelector('.modal-btn-confirm');

      const handleClose = () => {
        this.close();
        resolve(null);
      };

      closeBtn.addEventListener('click', handleClose);
      cancelBtn.addEventListener('click', handleClose);

      confirmBtn.addEventListener('click', () => {
        const selected = modal.querySelector(`input[name="${groupId}"]:checked`);
        const value = selected ? selected.value : null;
        this.close();
        resolve(value);
      });

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleClose();
      });

      // Escape key
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          handleClose();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      this.show(modal);

      // Focus first radio for accessibility
      const firstRadio = modal.querySelector('input[type="radio"]');
      if (firstRadio) setTimeout(() => firstRadio.focus(), 50);
    });
  }

  /**
   * Show a custom modal
   * @param {Object} options - Modal configuration
   */
  createModal(options = {}) {
    const {
      title = 'Modal',
      message = '',
      showInput = false,
      inputValue = '',
      inputPlaceholder = '',
      showCancel = true,
      confirmText = 'OK',
      cancelText = 'Cancel',
      onConfirm = () => {},
      onCancel = () => {}
    } = options;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${this.escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          ${message ? `<p class="modal-message">${this.escapeHtml(message)}</p>` : ''}
          ${showInput ? `
            <div class="modal-input-group">
              <input 
                type="text" 
                class="modal-input" 
                id="modal-input-field"
                value="${this.escapeHtml(inputValue)}"
                placeholder="${this.escapeHtml(inputPlaceholder)}"
                autofocus
              />
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          ${showCancel ? `
            <button class="btn secondary-btn modal-btn-cancel">${this.escapeHtml(cancelText)}</button>
          ` : ''}
          <button class="btn primary-btn modal-btn-confirm">${this.escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    // Attach event handlers
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-btn-cancel');
    const confirmBtn = modal.querySelector('.modal-btn-confirm');
    const inputField = modal.querySelector('#modal-input-field');

    const handleClose = () => {
      onCancel();
      this.close();
    };

    closeBtn.addEventListener('click', handleClose);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleClose);
    }

    confirmBtn.addEventListener('click', () => {
      const value = showInput && inputField ? inputField.value.trim() : null;
      onConfirm(value);
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleClose();
      }
    });

    // Handle Enter key for input
    if (inputField) {
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmBtn.click();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      });
    }

    // Handle Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    return modal;
  }

  /**
   * Show modal
   */
  show(modalElement) {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.appendChild(modalElement);
    backdrop.classList.add('modal-backdrop-show');

    // Focus input if present
    const input = modalElement.querySelector('#modal-input-field');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }

    this.currentModal = modalElement;
  }

  /**
   * Close modal
   */
  close() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.classList.remove('modal-backdrop-show');
    
    if (this.currentModal && this.currentModal.parentNode) {
      this.currentModal.parentNode.removeChild(this.currentModal);
    }
    
    this.currentModal = null;
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
const modal = new Modal();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = modal;
}

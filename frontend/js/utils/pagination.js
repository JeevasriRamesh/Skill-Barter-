/**
 * Pagination Utility
 * Provides pagination UI components and helpers
 */

/**
 * Render pagination controls
 * @param {HTMLElement} container - Container element to render pagination in
 * @param {Object} pagination - Pagination info object
 * @param {Function} onPageChange - Callback function(page) when page changes
 */
const renderPagination = (container, pagination, onPageChange) => {
  if (!pagination || pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const { page, totalPages, hasNextPage, hasPrevPage } = pagination;

  let paginationHTML = '<div class="pagination">';

  // Previous button
  if (hasPrevPage) {
    paginationHTML += `
      <button class="pagination-btn" data-page="${page - 1}" aria-label="Previous page">
        ← Previous
      </button>
    `;
  } else {
    paginationHTML += `
      <button class="pagination-btn pagination-btn-disabled" disabled aria-label="Previous page">
        ← Previous
      </button>
    `;
  }

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === page) {
      paginationHTML += `
        <button class="pagination-btn pagination-btn-active" disabled>${i}</button>
      `;
    } else {
      paginationHTML += `
        <button class="pagination-btn" data-page="${i}">${i}</button>
      `;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  if (hasNextPage) {
    paginationHTML += `
      <button class="pagination-btn" data-page="${page + 1}" aria-label="Next page">
        Next →
      </button>
    `;
  } else {
    paginationHTML += `
      <button class="pagination-btn pagination-btn-disabled" disabled aria-label="Next page">
        Next →
      </button>
    `;
  }

  paginationHTML += '</div>';

  // Page info
  paginationHTML += `
    <div class="pagination-info">
      Page ${page} of ${totalPages} (${pagination.total} total)
    </div>
  `;

  container.innerHTML = paginationHTML;

  // Attach event listeners
  container.querySelectorAll('.pagination-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newPage = parseInt(btn.getAttribute('data-page'));
      if (newPage !== page && newPage >= 1 && newPage <= totalPages) {
        onPageChange(newPage);
      }
    });
  });
};

/**
 * Build query string with pagination and filters
 * @param {Object} params - Parameters object
 * @returns {string} - Query string
 */
const buildQueryString = (params) => {
  const queryParts = [];
  
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== null && value !== undefined && value !== '') {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  return queryParts.length > 0 ? '?' + queryParts.join('&') : '';
};

// Export for use in other files
if (typeof window !== 'undefined') {
  window.paginationUtils = {
    renderPagination,
    buildQueryString
  };
}

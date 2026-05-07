/**
 * Pagination Utility
 * Provides pagination helpers for API endpoints
 */

/**
 * Parse pagination parameters from query string
 * @param {Object} query - Express request query object
 * @returns {Object} - { page, limit, skip }
 */
const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10)); // Max 100 items per page
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Create paginated response
 * @param {Array} data - Array of results
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} - Paginated response object
 */
const createPaginatedResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage
    }
  };
};

module.exports = {
  parsePaginationParams,
  createPaginatedResponse
};

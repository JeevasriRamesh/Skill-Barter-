/**
 * Search and Filter Utilities
 * Provides search and filter helpers for user queries
 */

/**
 * Build search query for users
 * @param {Object} query - Express request query object
 * @param {string} excludeUserId - User ID to exclude from results
 * @returns {Object} - MongoDB query object
 */
const buildUserSearchQuery = (query, excludeUserId) => {
  const searchQuery = {
    _id: { $ne: excludeUserId },
    isBlocked: false
  };

  // Filter by learning preference
  // Accepts: ?filter=learn|teach|both OR ?learningPreference=learn|teach|both
  const pref = (query.filter || query.learningPreference || '').trim();
  if (pref === 'learn' || pref === 'teach' || pref === 'both') {
    searchQuery.learningPreference = pref;
  }

  // Search by name or email (text search)
  if (query.search && query.search.trim()) {
    const searchTerm = query.search.trim();
    searchQuery.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // Filter by skills offered
  if (query.skillsOffered) {
    const skills = Array.isArray(query.skillsOffered)
      ? query.skillsOffered
      : [query.skillsOffered];
    
    searchQuery.skillsOffered = {
      $in: skills.map(s => new RegExp(s.trim(), 'i'))
    };
  }

  // Filter by skills wanted
  if (query.skillsWanted) {
    const skills = Array.isArray(query.skillsWanted)
      ? query.skillsWanted
      : [query.skillsWanted];
    
    searchQuery.skillsWanted = {
      $in: skills.map(s => new RegExp(s.trim(), 'i'))
    };
  }

  // Filter by skill (searches both offered and wanted)
  if (query.skill) {
    const skillTerm = query.skill.trim();
    searchQuery.$or = [
      ...(searchQuery.$or || []),
      { skillsOffered: { $regex: skillTerm, $options: 'i' } },
      { skillsWanted: { $regex: skillTerm, $options: 'i' } }
    ];
  }

  return searchQuery;
};

/**
 * Build filter query for requests
 * @param {Object} query - Express request query object
 * @param {string} userId - User ID for filtering
 * @param {string} type - 'sent' or 'received'
 * @returns {Object} - MongoDB query object
 */
const buildRequestFilterQuery = (query, userId, type) => {
  const filterQuery = {};

  // Filter by user (sent or received)
  if (type === 'sent') {
    filterQuery.fromUser = userId;
  } else if (type === 'received') {
    filterQuery.toUser = userId;
  }

  // Filter by status
  if (query.status) {
    const validStatuses = ['pending', 'accepted', 'rejected'];
    if (validStatuses.includes(query.status)) {
      filterQuery.status = query.status;
    }
  }

  return filterQuery;
};

module.exports = {
  buildUserSearchQuery,
  buildRequestFilterQuery
};

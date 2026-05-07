/**
 * Request Validation Utilities
 * Business logic validation for exchange requests
 */

const Request = require('../models/Request');
const User = require('../models/User');

/**
 * Check if a duplicate request already exists
 * @param {string} fromUserId - ID of user sending request
 * @param {string} toUserId - ID of user receiving request
 * @param {string} offeredSkill - Skill being offered
 * @param {string} requestedSkill - Skill being requested
 * @returns {Promise<Object|null>} - Existing request if duplicate found, null otherwise
 */
const checkDuplicateRequest = async (fromUserId, toUserId, offeredSkill, requestedSkill) => {
  try {
    const existingRequest = await Request.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
      offeredSkill: offeredSkill.trim(),
      requestedSkill: requestedSkill.trim(),
      status: { $in: ['pending', 'accepted'] }
    });

    return existingRequest;
  } catch (error) {
    console.error('Error checking duplicate request:', error);
    throw error;
  }
};

/**
 * Validate that skills exist in user profiles
 * @param {string} fromUserId - ID of user sending request
 * @param {string} toUserId - ID of user receiving request
 * @param {string} offeredSkill - Skill being offered (should be in fromUser's skillsOffered)
 * @param {string} requestedSkill - Skill being requested (should be in toUser's skillsOffered)
 * @returns {Promise<Object>} - { valid: boolean, errors: string[] }
 */
const validateSkillsExist = async (fromUserId, toUserId, offeredSkill, requestedSkill) => {
  try {
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(toUserId)
    ]);

    if (!fromUser || !toUser) {
      return {
        valid: false,
        errors: ['One or both users not found']
      };
    }

    const errors = [];

    // Check if offeredSkill is in fromUser's skillsOffered
    const offeredSkillLower = offeredSkill.trim().toLowerCase();
    const fromUserOffered = (fromUser.skillsOffered || []).map(s => s.toLowerCase());
    
    if (!fromUserOffered.includes(offeredSkillLower)) {
      errors.push(`You don't have "${offeredSkill}" in your offered skills`);
    }

    // Check if requestedSkill is in toUser's skillsOffered
    const requestedSkillLower = requestedSkill.trim().toLowerCase();
    const toUserOffered = (toUser.skillsOffered || []).map(s => s.toLowerCase());
    
    if (!toUserOffered.includes(requestedSkillLower)) {
      errors.push(`The user doesn't offer "${requestedSkill}"`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    console.error('Error validating skills:', error);
    return {
      valid: false,
      errors: ['Error validating skills']
    };
  }
};

module.exports = {
  checkDuplicateRequest,
  validateSkillsExist
};

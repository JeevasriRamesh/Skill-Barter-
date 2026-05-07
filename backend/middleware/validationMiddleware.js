/**
 * Validation Middleware
 * Provides request validation utilities
 */

const mongoose = require('mongoose');
const { inferRequestSkills } = require('../utils/inferRequestSkills');

/**
 * Validate request creation data
 * Accepts toUserId or receiverId; offeredSkill / requestedSkill optional (inferred from profiles).
 */
const validateRequestCreation = async (req, res, next) => {
  try {
    const rawTarget = req.body.toUserId || req.body.receiverId;
    let offeredSkill = req.body.offeredSkill;
    let requestedSkill = req.body.requestedSkill;
    const rawIntent = String(req.body.intent || '').trim().toLowerCase();
    const intent =
      rawIntent === 'teach'
        ? 'teach'
        : rawIntent === 'both'
          ? 'both'
          : rawIntent === 'learn'
            ? 'learn'
            : undefined;

    if (!rawTarget) {
      return res.status(400).json({
        message: 'Missing required fields',
        errors: {
          receiverId: 'receiverId or toUserId is required',
          toUserId: 'receiverId or toUserId is required'
        }
      });
    }

    const toUserId = String(rawTarget).trim();

    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }

    if (String(toUserId) === String(req.user.id)) {
      return res.status(400).json({
        message: 'Cannot send request to yourself'
      });
    }

    if (
      !offeredSkill ||
      !requestedSkill ||
      !String(offeredSkill).trim() ||
      !String(requestedSkill).trim()
    ) {
      const inferred = await inferRequestSkills(req.user.id, toUserId);
      offeredSkill = offeredSkill || inferred.offeredSkill;
      requestedSkill = requestedSkill || inferred.requestedSkill;
    }

    const trimmedOfferedSkill = String(offeredSkill || '').trim();
    const trimmedRequestedSkill = String(requestedSkill || '').trim();

    if (!trimmedOfferedSkill || !trimmedRequestedSkill) {
      return res.status(400).json({
        message:
          'Could not determine skills for this exchange. Add skillsOffered and skillsWanted on both profiles, or send offeredSkill and requestedSkill in the body.'
      });
    }

    req.validatedData = {
      toUserId,
      offeredSkill: trimmedOfferedSkill,
      requestedSkill: trimmedRequestedSkill,
      ...(intent ? { intent } : {})
    };

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ message: 'Validation error' });
  }
};

/**
 * Validate profile update data
 */
const validateProfileUpdate = (req, res, next) => {
  try {
    const { bio, skillsOffered, skillsWanted } = req.body;

    const validated = {};

    // Validate bio
    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({
          message: 'Bio must be a string'
        });
      }
      validated.bio = bio.trim();
    }

    // Validate and clean skillsOffered
    if (skillsOffered !== undefined) {
      if (!Array.isArray(skillsOffered)) {
        return res.status(400).json({
          message: 'skillsOffered must be an array'
        });
      }

      const cleaned = skillsOffered
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);

      // Remove duplicates (case-insensitive)
      const unique = [];
      const seen = new Set();
      for (const skill of cleaned) {
        const lower = skill.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(skill);
        }
      }

      validated.skillsOffered = unique;
    }

    // Validate and clean skillsWanted
    if (skillsWanted !== undefined) {
      if (!Array.isArray(skillsWanted)) {
        return res.status(400).json({
          message: 'skillsWanted must be an array'
        });
      }

      const cleaned = skillsWanted
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);

      // Remove duplicates (case-insensitive)
      const unique = [];
      const seen = new Set();
      for (const skill of cleaned) {
        const lower = skill.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(skill);
        }
      }

      validated.skillsWanted = unique;
    }

    req.validatedData = validated;
    next();
  } catch (error) {
    console.error('Profile validation error:', error);
    res.status(500).json({ message: 'Validation error' });
  }
};

module.exports = {
  validateRequestCreation,
  validateProfileUpdate
};

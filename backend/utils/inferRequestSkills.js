const User = require('../models/User');

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Infer offeredSkill / requestedSkill that satisfy validateSkillsExist:
 * - offeredSkill must be in sender's skillsOffered AND ideally something receiver wants
 * - requestedSkill must be in receiver's skillsOffered AND ideally something sender wants
 */
async function inferRequestSkills(fromUserId, toUserId) {
  const [me, them] = await Promise.all([
    User.findById(fromUserId).select('skillsOffered skillsWanted'),
    User.findById(toUserId).select('skillsOffered skillsWanted')
  ]);

  if (!me || !them) {
    return { offeredSkill: null, requestedSkill: null };
  }

  const myOffered = me.skillsOffered || [];
  const myWanted = me.skillsWanted || [];
  const theirOffered = them.skillsOffered || [];
  const theirWanted = them.skillsWanted || [];

  // Prefer: I offer something they want; I request something they offer
  let offeredSkill =
    myOffered.find((o) => theirWanted.some((w) => norm(o) === norm(w))) || null;
  let requestedSkill =
    myWanted.find((w) => theirOffered.some((o) => norm(w) === norm(o))) || null;

  // If one side missing, still pick valid skills for validation:
  // offered must be in myOffered; requested must be in theirOffered
  if (!offeredSkill && myOffered.length) {
    offeredSkill = myOffered[0];
  }
  if (!requestedSkill && theirOffered.length) {
    requestedSkill = theirOffered[0];
  }

  return {
    offeredSkill: offeredSkill ? String(offeredSkill).trim() : null,
    requestedSkill: requestedSkill ? String(requestedSkill).trim() : null
  };
}

module.exports = { inferRequestSkills };

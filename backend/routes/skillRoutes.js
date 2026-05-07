const express = require('express');
const SkillNotification = require('../models/SkillNotification');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Subscribe to be notified when a skill becomes available
// Body: { skillName }
router.post('/notify', authMiddleware, async (req, res) => {
  try {
    const skillName = String(req.body.skillName || '').trim().toLowerCase();
    if (!skillName) {
      return res.status(400).json({ message: 'skillName is required' });
    }

    await SkillNotification.updateOne(
      { userId: req.user.id, skillName },
      { $setOnInsert: { userId: req.user.id, skillName } },
      { upsert: true }
    );

    return res.status(201).json({ message: 'You will be notified when this skill becomes available' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ message: 'Already subscribed for this skill' });
    }
    console.error('Skill notify error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

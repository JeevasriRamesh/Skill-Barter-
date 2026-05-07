const express = require('express');
const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const User = require('../models/User');
const ExchangeSession = require('../models/ExchangeSession');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function idsEqual(a, b) {
  const idA = a && a._id ? a._id : a;
  const idB = b && b._id ? b._id : b;
  return String(idA) === String(idB);
}

async function refreshUserAverageRating(userId) {
  const result = await Rating.aggregate([
    { $match: { toUser: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: '$toUser',
        avg: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (!result.length) {
    await User.findByIdAndUpdate(userId, { $set: { averageRating: 0, ratingCount: 0 } });
    return;
  }

  const avg = Math.round(result[0].avg * 10) / 10;
  await User.findByIdAndUpdate(userId, {
    $set: {
      averageRating: avg,
      ratingCount: result[0].count
    }
  });
}

// Create rating after session completion
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { sessionId, toUser, rating, feedback } = req.body;
    if (!sessionId || !toUser || !Number.isFinite(Number(rating))) {
      return res.status(400).json({ message: 'sessionId, toUser and rating are required' });
    }

    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    const session = await ExchangeSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ message: 'Rating is allowed only after session completion' });
    }

    const fromUser = req.user.id;
    if (!idsEqual(session.user1, fromUser) && !idsEqual(session.user2, fromUser)) {
      return res.status(403).json({ message: 'Not part of this session' });
    }
    if (!idsEqual(session.user1, toUser) && !idsEqual(session.user2, toUser)) {
      return res.status(400).json({ message: 'Rated user must be part of the session' });
    }
    if (idsEqual(fromUser, toUser)) {
      return res.status(400).json({ message: 'You cannot rate yourself' });
    }

    const existing = await Rating.findOne({ sessionId, fromUser });
    if (existing) {
      return res.status(400).json({ message: 'You already rated for this session' });
    }

    const doc = await Rating.create({
      sessionId,
      fromUser,
      toUser,
      rating: numericRating,
      feedback: String(feedback || '').trim()
    });

    await refreshUserAverageRating(toUser);
    const populated = await doc.populate('fromUser toUser', 'name email');
    return res.status(201).json(populated);
  } catch (error) {
    console.error('Create rating error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// View my ratings by session IDs (used to prevent duplicate rating UI actions)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const raw = String(req.query.sessionIds || '').trim();
    if (!raw) return res.json([]);
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => mongoose.Types.ObjectId.isValid(s))
      .slice(0, 100);
    if (!ids.length) return res.json([]);

    const ratings = await Rating.find({
      fromUser: req.user.id,
      sessionId: { $in: ids }
    }).select('sessionId rating feedback createdAt');
    return res.json(ratings);
  } catch (error) {
    console.error('Get my ratings error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// View ratings received by a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const ratings = await Rating.find({ toUser: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromUser', 'name email');
    return res.json(ratings);
  } catch (error) {
    console.error('Get user ratings error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

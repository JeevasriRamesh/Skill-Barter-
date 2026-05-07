const express = require('express');
const ExchangeSession = require('../models/ExchangeSession');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

function idsEqual(a, b) {
  const idA = a && a._id ? a._id : a;
  const idB = b && b._id ? b._id : b;
  return String(idA) === String(idB);
}

function userInSession(session, userId) {
  return idsEqual(session.user1, userId) || idsEqual(session.user2, userId);
}

// List all exchange sessions for the logged-in user (dashboard overview)
router.get('/me/overview', authMiddleware, async (req, res) => {
  try {
    const sessions = await ExchangeSession.find({
      $or: [{ user1: req.user.id }, { user2: req.user.id }]
    })
      .populate('requestId', 'offeredSkill requestedSkill status fromUser toUser')
      .populate('user1', 'name email')
      .populate('user2', 'name email')
      .sort({ updatedAt: -1 });

    res.json(sessions);
  } catch (error) {
    console.error('Session overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark one session complete — register BEFORE /:requestId so "complete" is not captured as id
router.put('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const session = await ExchangeSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!userInSession(session, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to modify this session' });
    }

    if (!session.proofUpload) {
      return res.status(400).json({ message: 'Upload proof before completing a session' });
    }

    if (session.completedSessions >= session.totalSessions) {
      return res.status(400).json({ message: 'All sessions already completed' });
    }

    session.completedSessions += 1;
    if (session.completedSessions > session.totalSessions) {
      session.completedSessions = session.totalSessions;
    }
    session.progressPercentage = Math.round(
      (session.completedSessions / session.totalSessions) * 100
    );

    if (session.completedSessions >= session.totalSessions) {
      session.status = 'completed';
    }

    await session.save();
    res.json({ message: 'Session updated', session });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload proof for a learning micro-session
router.post('/:id/upload-proof', authMiddleware, upload.single('proof'), async (req, res) => {
  try {
    const session = await ExchangeSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!userInSession(session, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to upload proof for this session' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Proof file is required' });
    }

    session.proofUpload = `/uploads/${req.file.filename}`;
    await session.save();

    return res.json({
      message: 'Proof uploaded successfully',
      proofUpload: session.proofUpload,
      session
    });
  } catch (error) {
    console.error('Upload proof error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get session by request ID (must be after /me/overview and /:id/complete)
router.get('/:requestId', authMiddleware, async (req, res) => {
  try {
    const session = await ExchangeSession.findOne({ requestId: req.params.requestId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!userInSession(session, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to view this session' });
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

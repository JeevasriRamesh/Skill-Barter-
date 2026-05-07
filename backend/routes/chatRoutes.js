const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const ExchangeSession = require('../models/ExchangeSession');
const Request = require('../models/Request');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

function idsEqual(a, b) {
  const idA = a && a._id ? a._id : a;
  const idB = b && b._id ? b._id : b;
  return String(idA) === String(idB);
}

function userInSession(session, userId) {
  return idsEqual(session.user1, userId) || idsEqual(session.user2, userId);
}

/** Exchange session must belong to an accepted request */
async function sessionAllowsChat(sessionId) {
  const session = await ExchangeSession.findById(sessionId);
  if (!session) return { ok: false, session: null, reason: 'Session not found' };

  const reqDoc = await Request.findById(session.requestId);
  if (!reqDoc || reqDoc.status !== 'accepted') {
    return { ok: false, session: null, reason: 'Chat is only available after the request is accepted' };
  }

  return { ok: true, session };
}

// GET messages for a session
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { session, ok, reason } = await sessionAllowsChat(req.params.sessionId);
    if (!ok) {
      return res.status(404).json({ message: reason });
    }

    if (!userInSession(session, req.user.id)) {
      return res.status(403).json({ message: 'Not part of this session' });
    }

    const messages = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('senderId', 'name email');

    res.json(messages);
  } catch (error) {
    console.error('Chat GET error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message || !String(message).trim()) {
      return res.status(400).json({ message: 'sessionId and message are required' });
    }

    const { session, ok, reason } = await sessionAllowsChat(sessionId);
    if (!ok) {
      return res.status(400).json({ message: reason });
    }

    if (!userInSession(session, req.user.id)) {
      return res.status(403).json({ message: 'Not part of this session' });
    }

    const doc = await ChatMessage.create({
      sessionId: session._id,
      senderId: req.user.id,
      message: String(message).trim()
    });

    const populated = await doc.populate('senderId', 'name email');
    res.status(201).json(populated);

    // Async email notification to the other participant (do not block API response)
    setImmediate(async () => {
      try {
        const sender = await User.findById(req.user.id).select('name');
        const otherId = idsEqual(session.user1, req.user.id) ? session.user2 : session.user1;
        const otherUser = await User.findById(otherId).select('email name');
        if (!otherUser?.email) return;

       
        const APP_URL = process.env.APP_URL || 'https://skill-barter.onrender.com';
        const preview = String(message)
          .trim()
          .split(/\s+/)
          .slice(0, 10)
          .join(' ');
        await sendEmail(
          otherUser.email,
          'New Message on SkillBarter',
          `<p>You received a new message on SkillBarter.</p>
           <p><strong>Sender:</strong> ${sender?.name || 'A user'}</p>
           <p><strong>Message preview:</strong> ${preview || '(empty message)'}</p>
           <p><a href="${SITE_URL}">Log in to view and reply</a></p>`
        );
      } catch (e) {
        console.error('Chat email notify failed:', e.message);
      }
    });
  } catch (error) {
    console.error('Chat POST error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

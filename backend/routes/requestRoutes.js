const express = require('express');
const Request = require('../models/Request');
const User = require('../models/User');
const ExchangeSession = require('../models/ExchangeSession');
const authMiddleware = require('../middleware/authMiddleware');
const { validateRequestCreation } = require('../middleware/validationMiddleware');
const { checkDuplicateRequest, validateSkillsExist } = require('../utils/requestValidation');
const { parsePaginationParams, createPaginatedResponse } = require('../utils/pagination');
const { buildRequestFilterQuery } = require('../utils/searchFilter');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

const SITE_URL = process.env.APP_URL || 'https://skill-barter-hxhk.onrender.com';

/** Compare Mongo ObjectId / string / populated ref safely */
function idsEqual(a, b) {
  const idA = a && a._id ? a._id : a;
  const idB = b && b._id ? b._id : b;
  return String(idA) === String(idB);
}

// Send exchange request
router.post('/', authMiddleware, validateRequestCreation, async (req, res) => {
  try {
    const { toUserId, offeredSkill, requestedSkill, intent } = req.validatedData;

    // Check if target user exists and is not blocked
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    if (toUser.isBlocked) {
      return res.status(403).json({ message: 'Target user is blocked' });
    }

    // Check for duplicate request
    const duplicate = await checkDuplicateRequest(
      req.user.id,
      toUserId,
      offeredSkill,
      requestedSkill
    );

    if (duplicate) {
      return res.status(409).json({
        message: 'A similar request already exists',
        existingRequest: duplicate
      });
    }

    // Validate that skills exist in user profiles
    const skillValidation = await validateSkillsExist(
      req.user.id,
      toUserId,
      offeredSkill,
      requestedSkill
    );

    if (!skillValidation.valid) {
      return res.status(400).json({
        message: 'Skill validation failed',
        errors: skillValidation.errors
      });
    }

    const request = await Request.create({
      fromUser: req.user.id,
      toUser: toUserId,
      offeredSkill,
      requestedSkill,
      ...(intent ? { intent } : {})
    });

    const populated = await request.populate('fromUser toUser', 'name email skillsOffered skillsWanted');

    try {
      const receiver = populated.toUser;
      const sender = populated.fromUser;
      if (receiver && receiver.email && sender && sender.name) {
        await sendEmail(
          receiver.email,
          'New skill exchange request — Skill Barter',
          `<p>User <strong>${sender.name}</strong> wants to learn <strong>${requestedSkill}</strong> from you.</p>
          <p><a href="${SITE_URL}">Open Skill Barter</a></p>`
        );
      }
    } catch (emailErr) {
      console.error('Request created but email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Request sent successfully',
      request: populated
    });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View sent requests (with pagination and filtering)
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    const filterQuery = buildRequestFilterQuery(req.query, req.user.id, 'sent');

    // Get total count
    const total = await Request.countDocuments(filterQuery);

    // Get paginated results
    const requests = await Request.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('toUser', 'name email skillsOffered skillsWanted');

    res.json(createPaginatedResponse(requests, page, limit, total));
  } catch (error) {
    console.error('Sent requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View received requests (with pagination and filtering)
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    const filterQuery = buildRequestFilterQuery(req.query, req.user.id, 'received');

    // Get total count
    const total = await Request.countDocuments(filterQuery);

    // Get paginated results
    const requests = await Request.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromUser', 'name email skillsOffered skillsWanted');

    res.json(createPaginatedResponse(requests, page, limit, total));
  } catch (error) {
    console.error('Received requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept request (PATCH and PUT — frontend uses PUT with Bearer token)
const acceptRequestHandler = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (!idsEqual(request.toUser, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    const wasAlreadyAccepted = request.status === 'accepted';

    if (!wasAlreadyAccepted) {
      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Only pending requests can be accepted' });
      }
      request.status = 'accepted';
      await request.save();
    }

    // Exactly one ExchangeSession per request (unique index on requestId)
    let session = await ExchangeSession.findOne({ requestId: request._id });
    if (!session) {
      try {
        session = await ExchangeSession.create({
          requestId: request._id,
          user1: request.fromUser,
          user2: request.toUser,
          totalSessions: 5,
          completedSessions: 0,
          progressPercentage: 0,
          status: 'ongoing'
        });
      } catch (createErr) {
        // Race: another request created it — fetch existing
        if (createErr.code === 11000) {
          session = await ExchangeSession.findOne({ requestId: request._id });
        } else {
          throw createErr;
        }
      }
    }

    const populated = await request.populate('fromUser toUser', 'name email');

    try {
      if (!wasAlreadyAccepted) {
        const sender = populated.fromUser;
        const receiver = populated.toUser;
        if (sender && sender.email && receiver && receiver.name) {
          await sendEmail(
            sender.email,
            'Your exchange request was accepted — Skill Barter',
            `<p>Your request to learn <strong>${request.requestedSkill}</strong> from <strong>${receiver.name}</strong> has been accepted.</p>
            <p><a href="${SITE_URL}">Open Skill Barter</a></p>`
          );
        }
      }
    } catch (emailErr) {
      console.error('Request accepted but email failed:', emailErr.message);
    }

    res.json({
      message: wasAlreadyAccepted ? 'Request already accepted' : 'Request accepted',
      request: populated,
      session
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

router.patch('/:id/accept', authMiddleware, acceptRequestHandler);
router.put('/:id/accept', authMiddleware, acceptRequestHandler);

// Reject request
router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (!idsEqual(request.toUser, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    request.status = 'rejected';
    await request.save();

    const populated = await request.populate('fromUser toUser', 'name email');

    res.json({ message: 'Request rejected', request: populated });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


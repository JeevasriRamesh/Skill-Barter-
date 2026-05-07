const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { validateProfileUpdate } = require('../middleware/validationMiddleware');
const { parsePaginationParams, createPaginatedResponse } = require('../utils/pagination');
const { buildUserSearchQuery } = require('../utils/searchFilter');
const upload = require('../middleware/uploadMiddleware');
const SkillNotification = require('../models/SkillNotification');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile (bio, skillsOffered, skillsWanted)
router.put('/me', authMiddleware, validateProfileUpdate, async (req, res) => {
  try {
    const validated = req.validatedData;

    const before = await User.findById(req.user.id).select('skillsOffered name email');
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: validated },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });

    // Async: if user added new offered skills, notify subscribers
    try {
      const prevSkills = (before?.skillsOffered || []).map((s) => String(s).trim().toLowerCase());
      const nextSkills = (user?.skillsOffered || []).map((s) => String(s).trim().toLowerCase());
      const newlyAdded = nextSkills.filter((s) => s && !prevSkills.includes(s));

      if (newlyAdded.length) {
        setImmediate(async () => {
          try {
            const subs = await SkillNotification.find({
              skillName: { $in: newlyAdded }
            }).populate('userId', 'email name');

            const SITE_URL = process.env.APP_URL || 'https://skill-barter.onrender.com';

            for (const sub of subs) {
              const receiver = sub.userId;
              if (!receiver?.email) continue;
              await sendEmail(
                receiver.email,
                `Skill "${sub.skillName}" is now available — Skill Barter`,
                `<p>Good news! <strong>${user.name || 'A user'}</strong> just added <strong>${sub.skillName}</strong> to their offered skills.</p>
                 <p><a href="${SITE_URL}">Open Skill Barter</a></p>`
              );
              // optional: remove subscription after notifying
              await SkillNotification.deleteOne({ _id: sub._id });
            }
          } catch (e) {
            console.error('Skill notify async error:', e.message);
          }
        });
      }
    } catch (e) {
      console.error('Skill notify setup error:', e.message);
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile verification proof
router.post('/upload-verification', authMiddleware, upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Verification proof file is required' });
    }

    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          verificationProof: `/uploads/${req.file.filename}`,
          verificationStatus: 'pending',
          isVerified: false,
          verificationActionToken: token
        }
      },
      { new: true }
    ).select('-password');

    // Async: email admin with approve/reject links
    setImmediate(async () => {
      try {
        const adminEmail = 'skillbarterr@gmail.com';
        const SITE_URL = process.env.APP_URL || 'http://localhost:5000';
        const approveUrl = `${SITE_URL}/api/admin/verify/${user._id}?status=approved&token=${encodeURIComponent(token)}`;
        const rejectUrl = `${SITE_URL}/api/admin/verify/${user._id}?status=rejected&token=${encodeURIComponent(token)}`;
        await sendEmail(
          adminEmail,
          'New verification submitted — Skill Barter',
          `<p><strong>${user.name}</strong> uploaded verification proof.</p>
           <p>Proof: <a href="${SITE_URL}${user.verificationProof}">View proof</a></p>
           <p>
             <a href="${approveUrl}" style="display:inline-block;padding:10px 14px;background:#22c55e;color:#022c22;border-radius:8px;text-decoration:none;margin-right:8px;">Approve</a>
             <a href="${rejectUrl}" style="display:inline-block;padding:10px 14px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;">Reject</a>
           </p>`
        );
      } catch (e) {
        console.error('Admin verification email failed:', e.message);
      }
    });

    return res.json({
      message: 'Verification proof uploaded and sent for review',
      user
    });
  } catch (error) {
    console.error('Upload verification error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile photo (JPG/PNG/WEBP)
router.post('/upload-profile-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Profile photo file is required' });
    }

    const mt = String(req.file.mimetype || '').toLowerCase();
    if (mt !== 'image/jpeg' && mt !== 'image/png' && mt !== 'image/webp') {
      return res.status(400).json({ message: 'Only JPG, PNG, or WEBP images are allowed' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { profilePicture: `/uploads/${req.file.filename}` } },
      { new: true }
    ).select('-password');

    return res.json({
      message: 'Profile photo uploaded',
      user
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Like / interest system
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (String(targetId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot like your own profile' });
    }

    const target = await User.findById(targetId).select('_id isBlocked');
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.isBlocked) return res.status(403).json({ message: 'User is blocked' });

    const me = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { likedUsers: targetId } },
      { new: true }
    ).select('likedUsers');

    return res.json({ message: 'Liked', likedUsers: me.likedUsers });
  } catch (error) {
    console.error('Like user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Browse users (all except logged-in user) with search, filter, and pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    
    // Build search and filter query
    const searchQuery = buildUserSearchQuery(req.query, req.user.id);

    // Get total count for pagination
    const total = await User.countDocuments(searchQuery);

    // Get paginated results
    const users = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Return paginated response
    res.json(createPaginatedResponse(users, page, limit, total));
  } catch (error) {
    console.error('Browse users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Skill matching: mutual (full barter) + partial (one-way overlap), never empty when possible
router.get('/match', authMiddleware, async (req, res) => {
  try {
    const meId = req.user.id;
    const currentUser = await User.findById(meId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const skillsOffered = currentUser.skillsOffered || [];
    const skillsWanted = currentUser.skillsWanted || [];

    const baseFilter = { _id: { $ne: meId }, isBlocked: false };

    let mutualMatches = [];

    if (skillsOffered.length && skillsWanted.length) {
      const mutualQuery = {
        ...baseFilter,
        skillsOffered: { $in: skillsWanted },
        skillsWanted: { $in: skillsOffered }
      };
      mutualMatches = await User.find(mutualQuery).select('-password').sort({ createdAt: -1 }).limit(50);
    }

    const mutualIdList = mutualMatches.map((u) => u._id);

    let partialMatches = [];

    const orOverlap = [];
    if (skillsWanted.length) {
      orOverlap.push({ skillsOffered: { $in: skillsWanted } });
    }
    if (skillsOffered.length) {
      orOverlap.push({ skillsWanted: { $in: skillsOffered } });
    }

    if (orOverlap.length) {
      const partialQuery = {
        isBlocked: false,
        $or: orOverlap,
        _id: mutualIdList.length
          ? { $ne: meId, $nin: mutualIdList }
          : { $ne: meId }
      };
      partialMatches = await User.find(partialQuery).select('-password').sort({ createdAt: -1 }).limit(50);
    }

    // Suggested users if still nothing (keep UI useful)
    if (mutualMatches.length === 0 && partialMatches.length === 0) {
      partialMatches = await User.find(baseFilter).select('-password').sort({ createdAt: -1 }).limit(12);
    }

    res.json({ mutualMatches, partialMatches });
  } catch (error) {
    console.error('Match users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile details for discovery card click
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user || user.isBlocked) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Get user details error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


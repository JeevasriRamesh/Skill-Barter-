const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Request = require('../models/Request');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { parsePaginationParams, createPaginatedResponse } = require('../utils/pagination');
const { buildUserSearchQuery } = require('../utils/searchFilter');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Email action links (no JWT; one-time token stored on user)
router.get('/verify/:userId', async (req, res) => {
  try {
    const { status, token } = req.query;
    const desired = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : '';
    if (!desired || !token) {
      return res.status(400).send('Invalid verification link');
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).send('User not found');
    if (!user.verificationActionToken || String(user.verificationActionToken) !== String(token)) {
      return res.status(403).send('Verification link is invalid or expired');
    }

    user.verificationStatus = desired;
    user.isVerified = desired === 'approved';
    user.verificationActionToken = '';
    await user.save();

    return res.send(
      `Verification updated: ${desired}. You can close this tab.`
    );
  } catch (error) {
    console.error('Email verify action error:', error);
    return res.status(500).send('Server error');
  }
});

// Admin login (separate route)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin' });

    if (!admin) {
      return res.status(400).json({ message: 'Admin not found or invalid credentials' });
    }

    if (admin.isBlocked) {
      return res.status(403).json({ message: 'Admin account is blocked' });
    }

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(admin);

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// All routes below require admin auth
router.use(authMiddleware, adminMiddleware);

// Platform statistics
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRequests = await Request.countDocuments();
    const acceptedRequests = await Request.countDocuments({ status: 'accepted' });
    const rejectedRequests = await Request.countDocuments({ status: 'rejected' });
    const pendingRequests = await Request.countDocuments({ status: 'pending' });

    res.json({
      totalUsers,
      totalRequests,
      acceptedRequests,
      rejectedRequests,
      pendingRequests
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View all users (with pagination and search)
router.get('/users', async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    
    // Build search query (admin can see all users including blocked)
    const searchQuery = {};
    
    if (req.query.search && req.query.search.trim()) {
      const searchTerm = req.query.search.trim();
      searchQuery.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Filter by blocked status
    if (req.query.isBlocked !== undefined) {
      searchQuery.isBlocked = req.query.isBlocked === 'true';
    }

    // Filter by role
    if (req.query.role) {
      searchQuery.role = req.query.role;
    }

    // Get total count
    const total = await User.countDocuments(searchQuery);

    // Get paginated results
    const users = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(createPaginatedResponse(users, page, limit, total));
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await Request.deleteMany({
      $or: [{ fromUser: user._id }, { toUser: user._id }]
    });
    res.json({ message: 'User and related requests deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Block user
router.patch('/users/:id/block', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isBlocked: true } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User blocked', user });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unblock user
router.patch('/users/:id/unblock', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isBlocked: false } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User unblocked', user });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve / reject user verification proof
router.put('/verify-user/:id', async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const update =
      action === 'approve'
        ? { isVerified: true, verificationStatus: 'approved' }
        : { isVerified: false, verificationStatus: 'rejected' };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      message: `Verification ${action}d`,
      user
    });
  } catch (error) {
    console.error('Verify user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Required API: PUT /api/admin/verify/:userId  Body: { status: approved|rejected }
router.put('/verify/:userId', async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const update =
      status === 'approved'
        ? { isVerified: true, verificationStatus: 'approved' }
        : { isVerified: false, verificationStatus: 'rejected' };

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: update, $unset: { verificationActionToken: '' } },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ message: 'Verification updated', user });
  } catch (error) {
    console.error('Verify user (PUT) error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// View all exchange requests (with pagination and filtering)
router.get('/requests', async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    
    const filter = {};
    
    // Filter by status
    if (req.query.status) {
      const validStatuses = ['pending', 'accepted', 'rejected'];
      if (validStatuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    // Get total count
    const total = await Request.countDocuments(filter);

    // Get paginated results
    const requests = await Request.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromUser toUser', 'name email');

    res.json(createPaginatedResponse(requests, page, limit, total));
  } catch (error) {
    console.error('Admin get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete exchange request
router.delete('/requests/:id', async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


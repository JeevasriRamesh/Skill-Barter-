const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateEmail } = require('../utils/emailValidation');
const { sendEmail } = require('../services/emailService');

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

const ADMIN_EMAIL = 'skillbarterr@gmail.com';
const ADMIN_PASSWORD = '31jeevs4';

// User registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required',
        errors: {
          name: !name ? 'Name is required' : undefined,
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        }
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        message: emailValidation.error,
        errors: {
          email: emailValidation.error
        }
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters',
        errors: {
          password: 'Password must be at least 6 characters'
        }
      });
    }

    // Validate name (trim and check length)
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({
        message: 'Name cannot be empty',
        errors: {
          name: 'Name cannot be empty'
        }
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already registered',
        errors: {
          email: 'Email already registered'
        }
      });
    }

    const user = await User.create({
      name: trimmedName,
      email: email.toLowerCase().trim(),
      password,
      role: email.toLowerCase().trim() === ADMIN_EMAIL ? 'admin' : 'user'
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

    // Async email to admin on new registration (do not block response)
    // Note: if admin registers themselves, this still sends (ok).
    setImmediate(async () => {
      try {
        await sendEmail(
          ADMIN_EMAIL,
          'New user registered — Skill Barter',
          `<p><strong>${user.name}</strong> registered with email <strong>${user.email}</strong>.</p>`
        );
      } catch (e) {
        console.error('Admin new-user email failed:', e.message);
      }
    });
    return;
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        errors: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        }
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        message: emailValidation.error,
        errors: {
          email: emailValidation.error
        }
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'User is blocked. Contact admin.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Controlled admin role assignment by known admin email+password
    // (Keeps JWT system unchanged; only updates role field)
    if (user.email === ADMIN_EMAIL && password === ADMIN_PASSWORD && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (handled client-side by removing token, but endpoint for completeness)
router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out successfully (please remove token on client)' });
});

module.exports = router;


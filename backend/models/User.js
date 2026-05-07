const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    bio: {
      type: String,
      default: ''
    },
    skillsOffered: [
      {
        type: String,
        trim: true
      }
    ],
    skillsWanted: [
      {
        type: String,
        trim: true
      }
    ],
    profilePicture: {
      type: String,
      default: ''
    },
    age: {
      type: Number,
      min: 13,
      max: 120
    },
    learningPreference: {
      type: String,
      enum: ['learn', 'teach', 'both'],
      default: 'both'
    },
    likedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationProof: {
      type: String,
      default: ''
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'rejected'
    },
    verificationActionToken: {
      type: String,
      default: ''
    },
    averageRating: {
      type: Number,
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add indexes for performance
userSchema.index({ email: 1 }); // Already unique, but explicit index
userSchema.index({ skillsOffered: 1 }); // For skill matching queries
userSchema.index({ skillsWanted: 1 }); // For skill matching queries
userSchema.index({ name: 'text', email: 'text' }); // Text search index
userSchema.index({ isBlocked: 1 }); // For filtering blocked users

const User = mongoose.model('User', userSchema);

module.exports = User;


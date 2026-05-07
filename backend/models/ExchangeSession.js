const mongoose = require('mongoose');

const exchangeSessionSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      unique: true
    },
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    totalSessions: {
      type: Number,
      default: 5
    },
    completedSessions: {
      type: Number,
      default: 0
    },
    progressPercentage: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['ongoing', 'completed'],
      default: 'ongoing'
    },
    proofUpload: {
      type: String,
      default: ''
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

// ensure one session per request
exchangeSessionSchema.index({ requestId: 1 }, { unique: true });

const ExchangeSession = mongoose.model('ExchangeSession', exchangeSessionSchema);

module.exports = ExchangeSession;

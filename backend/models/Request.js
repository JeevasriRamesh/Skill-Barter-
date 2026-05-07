const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    offeredSkill: {
      type: String,
      required: true,
      trim: true
    },
    requestedSkill: {
      type: String,
      required: true,
      trim: true
    },
    intent: {
      type: String,
      enum: ['learn', 'teach', 'both'],
      default: 'learn'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
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

// Add indexes for performance
requestSchema.index({ fromUser: 1, status: 1 }); // For sent requests queries
requestSchema.index({ toUser: 1, status: 1 }); // For received requests queries
requestSchema.index({ createdAt: -1 }); // For sorting by date
requestSchema.index({ status: 1 }); // For filtering by status

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;


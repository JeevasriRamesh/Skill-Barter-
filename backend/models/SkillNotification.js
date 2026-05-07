const mongoose = require('mongoose');

const skillNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    skillName: {
      type: String,
      required: true,
      trim: true,
      index: true
    }
  },
  { timestamps: true }
);

skillNotificationSchema.index({ userId: 1, skillName: 1 }, { unique: true });

module.exports = mongoose.model('SkillNotification', skillNotificationSchema);

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  // Events this student has manually dismissed — they won't appear in notifications
  dismissedEvents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    }
  ],
}, { timestamps: true });

subscriptionSchema.index({ studentId: 1 });
subscriptionSchema.index({ groupId: 1 });
subscriptionSchema.index({ studentId: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
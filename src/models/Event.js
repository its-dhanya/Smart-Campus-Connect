const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  // Core event info
  domain: {
    type: String,
    enum: ['transport', 'academics', 'laundry', 'mess'],
    required: true
  },
  type: {
    type: String,
    required: true
    // Examples: BUS_DELAYED, CLASS_CANCELLED, WASH_MACHINE_COMPLETED, MESS_CHECKIN
  },
  
  // Target info
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  entityId: {
    type: String
    // Examples: BUS_052, HOSTEL-A, MAIN_MESS
  },
  
  // Metadata specific to domain
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Examples:
    // Transport: { busId, route, delay, reason }
    // Academic: { courseId, newTime, newHall, reason }
    // Laundry: { machine, block, reason }
    // Mess: { studentId, meal, refundAmount }
  },
  
  // Who fired the event
  firedBy: {
    type: String,
    required: true
    // Username of admin who fired event
  },
  
  // Event status tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  
  // Delivery tracking
  deliveryStats: {
    total: { type: Number, default: 0 },        // Total recipients
    delivered: { type: Number, default: 0 },     // Successfully delivered
    failed: { type: Number, default: 0 },        // Delivery failed
    pending: { type: Number, default: 0 }        // Still pending
  },
  
  // Error tracking
  errors: [
    {
      studentId: mongoose.Schema.Types.ObjectId,
      error: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date
}, { timestamps: true });

// Indexes for queries
eventSchema.index({ domain: 1, createdAt: -1 });
eventSchema.index({ groupId: 1, createdAt: -1 });
eventSchema.index({ firedBy: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);

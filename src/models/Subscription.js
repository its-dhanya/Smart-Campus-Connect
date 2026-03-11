const mongoose = require('mongoose')

const subscriptionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  groupId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Group',   required: true },
}, { timestamps: true });

subscriptionSchema.index({ studentId: 1, groupId: 1 }, { unique: true });
subscriptionSchema.index({ groupId: 1 });

module.exports = subscriptionSchema;
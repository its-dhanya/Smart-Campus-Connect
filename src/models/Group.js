// Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  type:    { type: String, enum: ['TEACHER', 'BUS', 'LAUNDRY', 'MESS'], required: true },
  ownerId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema); 
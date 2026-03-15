// Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  name:        { type: String, required: true },
  rollNo:      { type: String, required: true, unique: true },
  department:  { type: String },
  semester:    { type: Number },
  hostelBlock: { type: String },
  role: {                                         // ✅ added
    type: String,
    enum: ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN', 'STUDENT'],
    default: 'STUDENT'
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  fcmToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);  // ✅ export as model
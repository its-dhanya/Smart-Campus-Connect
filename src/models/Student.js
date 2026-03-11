const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
  // auth
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: true },

  // profile
  name:        { type: String, required: true },
  rollNo:      { type: String, required: true, unique: true },
  department:  { type: String },
  semester:    { type: Number },
  hostelBlock: { type: String },

  // groups this student belongs to
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],

  // notification delivery
  fcmToken:    { type: String },
}, { timestamps: true });
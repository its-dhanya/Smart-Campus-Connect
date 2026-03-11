
const mongoose = require('mongoose')

const groupSchema = new mongoose.Schema({
  name:    { type: String, required: true },   // "Bus 052", "Prof. Smith CS101"
  type:    { type: String, enum: ['TEACHER', 'BUS', 'LAUNDRY', 'MESS'], required: true },
  ownerId: { type: String, required: true },   // "BUS_052", "TEACHER_01"
}, { timestamps: true });


const express = require('express');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const groupRoutes = require('./routes/groupRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');
const academicRoutes = require('./routes/academicRoutes');
const transportRoutes = require('./routes/transportRoutes');
const messRoutes = require('./routes/messRoutes');
const laundryRoutes = require('./routes/laundryRoutes');
const dbConnect = require('./config/dbConnect');
const { createDefaultAdmin } = require('./controllers/authController');

const app = express();

app.use(express.json());

dbConnect();
createDefaultAdmin();

app.use('/auth', authRoutes);
app.use('/students', studentRoutes);
app.use('/groups', groupRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/events', eventRoutes);
app.use('/admin', adminRoutes);
app.use('/academics', academicRoutes);
app.use('/bus', transportRoutes);
app.use('/mess', messRoutes);
app.use('/laundry', laundryRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;

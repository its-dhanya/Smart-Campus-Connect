const Student = require('../models/Student');
const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Event = require('../models/Event');
const bcrypt = require('bcryptjs');
const { sendMulticast, sendSingle } = require('../services/fcmService');

const createUser = async (req, res) => {
  try {
    const { email, password, name, rollNo, department, semester, hostelBlock, role } = req.body;
    const existingUser = await Student.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User with this email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Student({ email, password: hashedPassword, name, rollNo, department, semester, hostelBlock, role: role || 'STUDENT' });
    await newUser.save();
    res.status(201).json({ message: `User created with email ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await Student.find({}, '-password');
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Student.findById(id, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.password) updates.password = await bcrypt.hash(updates.password, 10);
    const updatedUser = await Student.findByIdAndUpdate(id, updates, { new: true, select: '-password' });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await Student.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getStats = async (req, res) => {
  try {
    const [totalStudents, totalGroups, totalSubscriptions, totalEvents, recentEvents] = await Promise.all([
      Student.countDocuments({ role: 'STUDENT' }),
      Group.countDocuments(),
      Subscription.countDocuments(),
      Event.countDocuments(),
      Event.find().sort({ createdAt: -1 }).limit(5).select('domain type status createdAt'),
    ]);
    const eventsByDomain = await Event.aggregate([{ $group: { _id: '$domain', count: { $sum: 1 } } }]);
    const eventsByStatus = await Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({
      message: 'System statistics',
      stats: {
        users: { totalStudents, breakdown: await Student.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]) },
        groups: { total: totalGroups },
        subscriptions: { total: totalSubscriptions },
        events: {
          total: totalEvents,
          byDomain: Object.fromEntries(eventsByDomain.map(d => [d._id, d.count])),
          byStatus: Object.fromEntries(eventsByStatus.map(s => [s._id, s.count])),
          recent: recentEvents,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getQueueStatus = async (req, res) => {
  try {
    const eventQueue = require('../queue/eventQueue');
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      eventQueue.getWaitingCount(),
      eventQueue.getActiveCount(),
      eventQueue.getCompletedCount(),
      eventQueue.getFailedCount(),
      eventQueue.getDelayedCount(),
    ]);
    res.json({
      message: 'Queue status',
      queue: { name: 'campus-events', waiting, active, completed, failed, delayed },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};

const resendNotifications = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const subscriptions = await Subscription.find({ groupId: event.groupId }).populate('studentId', 'fcmToken name');
    const fcmTokens = subscriptions.filter(s => s.studentId.fcmToken).map(s => s.studentId.fcmToken);

    const notifTitle = `[Resent] ${event.type.replace(/_/g, ' ')}`;
    const notifBody = event.metadata?.reason || event.type.replace(/_/g, ' ');

    const { successCount, failureCount, failedTokens } = await sendMulticast({
      tokens: fcmTokens,
      title: notifTitle,
      body: notifBody,
      data: { domain: event.domain, eventType: event.type, eventId: String(event._id), resent: 'true' },
    });

    event.status = 'completed';
    event.deliveryStats = { total: subscriptions.length, delivered: successCount, failed: failureCount, pending: 0 };
    event.errors = failedTokens.map(ft => ({ error: `Token: ${ft.token} — ${ft.error}`, timestamp: new Date() }));
    event.completedAt = new Date();
    await event.save();

    res.json({
      message: 'Notifications resent successfully',
      eventId,
      domain: event.domain,
      type: event.type,
      deliveryStats: { total: subscriptions.length, delivered: successCount, failed: failureCount },
      status: 'completed',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, getStats, getQueueStatus, resendNotifications };
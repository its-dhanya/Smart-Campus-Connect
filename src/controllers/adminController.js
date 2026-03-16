const Student = require('../models/Student');
const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Event = require('../models/Event');
const bcrypt = require('bcryptjs');
let eventQueue;
try {
  eventQueue = require('../queue/eventQueue');
} catch (e) {
  eventQueue = null;
}

// Create a new user (Student) with specified role - SUPER_ADMIN only
const createUser = async (req, res) => {
  try {
    const { email, password, name, rollNo, department, semester, hostelBlock, role } = req.body;

    const existingUser = await Student.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Student({
      email,
      password: hashedPassword,
      name,
      rollNo,
      department,
      semester,
      hostelBlock,
      role: role || 'STUDENT',
    });

    await newUser.save();

    res.status(201).json({ message: `User created with email ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Get all users - SUPER_ADMIN only
const getAllUsers = async (req, res) => {
  try {
    const users = await Student.find({}, '-password');
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Get user by ID - SUPER_ADMIN only
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Student.findById(id, '-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Update user - SUPER_ADMIN only
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const updatedUser = await Student.findByIdAndUpdate(id, updates, {
      new: true,
      select: '-password',
    });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Delete user - SUPER_ADMIN only
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await Student.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// GET /admin/stats - System statistics
const getStats = async (req, res) => {
  try {
    const [totalStudents, totalGroups, totalSubscriptions, totalEvents, recentEvents] =
      await Promise.all([
        Student.countDocuments({ role: 'STUDENT' }),
        Group.countDocuments(),
        Subscription.countDocuments(),
        Event.countDocuments(),
        Event.find().sort({ createdAt: -1 }).limit(5).select('domain type status createdAt'),
      ]);

    const eventsByDomain = await Event.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
    ]);

    const eventsByStatus = await Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      message: 'System statistics',
      stats: {
        users: {
          totalStudents,
          breakdown: await Student.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
          ]),
        },
        groups: { total: totalGroups },
        subscriptions: { total: totalSubscriptions },
        events: {
          total: totalEvents,
          byDomain: Object.fromEntries(eventsByDomain.map((d) => [d._id, d.count])),
          byStatus: Object.fromEntries(eventsByStatus.map((s) => [s._id, s.count])),
          recent: recentEvents,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// GET /admin/queue-status - BullMQ queue status
const getQueueStatus = async (req, res) => {
  try {
    if (!eventQueue) {
      return res.status(503).json({ message: 'Queue not available' });
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      eventQueue.getWaitingCount(),
      eventQueue.getActiveCount(),
      eventQueue.getCompletedCount(),
      eventQueue.getFailedCount(),
      eventQueue.getDelayedCount(),
    ]);

    res.json({
      message: 'Queue status',
      queue: {
        name: 'campus-events',
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};

// POST /admin/resend-notifications/:eventId - Resend notifications for an event
const resendNotifications = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!eventQueue) {
      return res.status(503).json({ message: 'Queue not available' });
    }

    // Re-queue the event using the existing data
    await eventQueue.add(`${event.domain}-event`, {
      eventId: event._id,
      type: event.type,
      domain: event.domain,
      entityId: event.entityId,
      metadata: event.metadata,
      firedBy: req.user.name || 'SUPER_ADMIN',
      timestamp: new Date(),
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // Reset event status
    event.status = 'pending';
    await event.save();

    res.json({
      message: 'Notifications re-queued successfully',
      eventId,
      domain: event.domain,
      type: event.type,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getStats,
  getQueueStatus,
  resendNotifications,
};
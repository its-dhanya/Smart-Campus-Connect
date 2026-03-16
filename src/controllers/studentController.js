const Student = require('../models/Student');
const Subscription = require('../models/Subscription');
const Event = require('../models/Event');
const bcrypt = require('bcryptjs');

/**
 * GET /students/:id - Get student profile
 */
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    // STUDENT can only view own profile
    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only view own profile' });
    }

    const student = await Student.findById(id).select('-password');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({ message: 'Student profile retrieved', student });
  } catch (err) {
    console.error('Get student error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /students/:id - Update student profile
 */
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // STUDENT can only update own profile
    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only update own profile' });
    }

    // Non-admins cannot change role
    if (req.user.role !== 'SUPER_ADMIN') {
      delete updates.role;
    }

    // Hash new password if provided
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const student = await Student.findByIdAndUpdate(id, updates, {
      new: true,
      select: '-password',
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({ message: 'Student profile updated', student });
  } catch (err) {
    console.error('Update student error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /students/:id/fcm-token - Update FCM push notification token
 */
const updateFcmToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { fcmToken } = req.body;

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only update own FCM token' });
    }

    if (!fcmToken) {
      return res.status(400).json({ message: 'fcmToken is required' });
    }

    const student = await Student.findByIdAndUpdate(
      id,
      { fcmToken },
      { new: true, select: '-password' }
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({ message: 'FCM token updated successfully', studentId: id });
  } catch (err) {
    console.error('Update FCM token error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /students/:id/groups - Get all groups a student belongs to
 */
const getStudentGroups = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only view own groups' });
    }

    const subscriptions = await Subscription.find({ studentId: id }).populate(
      'groupId',
      'name type ownerId'
    );

    return res.json({
      message: 'Student groups retrieved',
      studentId: id,
      groups: subscriptions.map((s) => ({
        groupId: s.groupId._id,
        name: s.groupId.name,
        type: s.groupId.type,
        ownerId: s.groupId.ownerId,
      })),
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('Get student groups error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /students/:id/notifications - Get notifications for a student
 * Looks up events for all groups the student is subscribed to
 */
const getStudentNotifications = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only view own notifications' });
    }

    // Get all groups the student is subscribed to
    const subscriptions = await Subscription.find({ studentId: id });
    const groupIds = subscriptions.map((s) => s.groupId);

    // Find recent events for those groups
    const events = await Event.find({ groupId: { $in: groupIds } })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('domain type metadata status createdAt firedBy entityId');

    return res.json({
      message: 'Student notifications retrieved',
      studentId: id,
      notifications: events.map((e) => ({
        id: e._id,
        domain: e.domain,
        type: e.type,
        entityId: e.entityId,
        metadata: e.metadata,
        status: e.status,
        firedBy: e.firedBy,
        timestamp: e.createdAt,
      })),
      total: events.length,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getStudentById,
  updateStudent,
  updateFcmToken,
  getStudentGroups,
  getStudentNotifications,
};
const Student = require('../models/Student');
const Subscription = require('../models/Subscription');
const Event = require('../models/Event');
const Group = require('../models/Group');
const bcrypt = require('bcryptjs');

// Notifications expire after 24 hours
const NOTIFICATION_TTL_HOURS = 24;

/**
 * GET /students/:id - Get student profile
 */
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

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

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only update own profile' });
    }

    if (req.user.role !== 'SUPER_ADMIN') {
      delete updates.role;
    }

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
 * Map an admin role to the Group type(s) they manage.
 * Used so admins can see events for their own domain without needing subscriptions.
 */
const ROLE_TO_GROUP_TYPES = {
  BUS_ADMIN:     ['BUS'],
  LAUNDRY_ADMIN: ['LAUNDRY'],
  MESS_ADMIN:    ['MESS'],
  TEACHER:       ['TEACHER'],
  SUPER_ADMIN:   ['BUS', 'LAUNDRY', 'MESS', 'TEACHER'], // sees everything
};

/**
 * GET /students/:id/notifications
 *
 * Rules:
 *  - Only returns events created within the last NOTIFICATION_TTL_HOURS (24 h).
 *  - Events the student has manually dismissed are excluded.
 *  - Each notification includes an `expiresAt` field so the client can show a
 *    countdown / auto-hide without polling.
 *
 *  For STUDENT: events come from subscribed groups only.
 *  For admin roles: events come from every group in their managed domain(s),
 *    so they can see the notifications they fired without needing subscriptions.
 */
const getStudentNotifications = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only view own notifications' });
    }

    // TTL cutoff — events older than this are invisible
    const cutoff = new Date(Date.now() - NOTIFICATION_TTL_HOURS * 60 * 60 * 1000);

    let groupIds = [];
    let dismissedIds = [];

    const adminGroupTypes = ROLE_TO_GROUP_TYPES[req.user.role];

    if (adminGroupTypes) {
      // Admin path: find all groups of the relevant type(s)
      const groups = await Group.find({ type: { $in: adminGroupTypes } }).select('_id');
      groupIds = groups.map((g) => g._id);
      // Load dismissals stored on the admin Student document
      const adminDoc = await Student.findById(id).select('dismissedEvents');
      dismissedIds = adminDoc?.dismissedEvents || [];
    } else {
      // Student path: find groups via subscriptions
      const subscriptions = await Subscription.find({ studentId: id });
      groupIds = subscriptions.map((s) => s.groupId);
      dismissedIds = subscriptions.flatMap((s) => s.dismissedEvents || []);
    }

    const events = await Event.find({
      groupId: { $in: groupIds },
      createdAt: { $gte: cutoff },
      ...(dismissedIds.length ? { _id: { $nin: dismissedIds } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('domain type metadata status createdAt firedBy entityId groupId');

    // For academic events whose metadata.courseCode is still a raw ObjectId
    // (fired before the backend fix), resolve the real courseCode from the Group.
    const ObjectIdRegex = /^[a-f0-9]{24}$/i;
    const staleAcademicEvents = events.filter(
      (e) => e.domain === 'academics' && ObjectIdRegex.test(e.metadata?.courseCode)
    );
    if (staleAcademicEvents.length > 0) {
      const groupIdSet = [...new Set(staleAcademicEvents.map((e) => String(e.groupId)))];
      const groups = await Group.find({ _id: { $in: groupIdSet } }).select('_id ownerId name');
      const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));
      staleAcademicEvents.forEach((e) => {
        const g = groupMap[String(e.groupId)];
        if (g) {
          e.metadata = { ...e.metadata, courseCode: g.ownerId, courseName: g.name };
        }
      });
    }

    return res.json({
      message: 'Notifications retrieved',
      studentId: id,
      ttlHours: NOTIFICATION_TTL_HOURS,
      notifications: events.map((e) => ({
        id: e._id,
        domain: e.domain,
        type: e.type,
        entityId: e.entityId,
        metadata: e.metadata,
        status: e.status,
        firedBy: e.firedBy,
        timestamp: e.createdAt,
        expiresAt: new Date(
          new Date(e.createdAt).getTime() + NOTIFICATION_TTL_HOURS * 60 * 60 * 1000
        ),
      })),
      total: events.length,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /students/:id/notifications/:eventId
 *
 * Dismiss a notification so it no longer appears in the feed.
 * The Event document is never hard-deleted — other recipients still need it.
 *
 * - STUDENT: dismissal stored on the Subscription record for the group.
 * - Admin roles: no Subscription exists, so dismissal stored directly on
 *   the Student (admin) document in a top-level dismissedEvents array.
 */
const deleteStudentNotification = async (req, res) => {
  try {
    const { id, eventId } = req.params;

    if (req.user.role === 'STUDENT' && id !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only delete own notifications' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const adminGroupTypes = ROLE_TO_GROUP_TYPES[req.user.role];

    if (adminGroupTypes) {
      // Admin path — store dismissal on the Student document directly
      await Student.findByIdAndUpdate(id, {
        $addToSet: { dismissedEvents: eventId },
      });
    } else {
      // Student path — store dismissal on the Subscription for this group
      const subscription = await Subscription.findOne({
        studentId: id,
        groupId: event.groupId,
      });

      if (!subscription) {
        return res.status(403).json({ message: 'Notification does not belong to this student' });
      }

      if (!subscription.dismissedEvents) {
        subscription.dismissedEvents = [];
      }

      if (!subscription.dismissedEvents.map(String).includes(String(eventId))) {
        subscription.dismissedEvents.push(eventId);
        await subscription.save();
      }
    }

    return res.json({ message: 'Notification dismissed', eventId });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getStudentById,
  updateStudent,
  updateFcmToken,
  getStudentGroups,
  getStudentNotifications,
  deleteStudentNotification,
};
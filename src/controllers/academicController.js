const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const user = require('../models/Student');
const Event = require('../models/Event');
const eventQueue = require('../queue/eventQueue');

/**
 * ACADEMIC CONTROLLER
 * Handles all academic-domain specific operations
 */

exports.getAllAcademicGroups = async (req, res) => {
  try {
    let query = { type: 'TEACHER' };
    if (req.user.role === 'TEACHER') {
      query._id = { $in: req.user.groups };
    }

    const groups = await Group.find(query).select('_id name ownerId type createdAt');

    return res.json({
      message: 'Academic groups retrieved successfully',
      role: req.user.role,
      accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all groups' : 'assigned groups only',
      count: groups.length,
      groups: groups.map(g => ({
        id: g._id,
        name: g.name,
        courseCode: g.ownerId,
        type: g.type,
        createdAt: g.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting academic groups:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.createAcademicGroup = async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({ message: 'Name and ownerId are required' });
    }

    const existingGroup = await Group.findOne({ name, ownerId, type: 'TEACHER' });
    if (existingGroup) {
      return res.status(400).json({ message: 'Academic group already exists' });
    }

    const newGroup = new Group({ name, ownerId, type: 'TEACHER' });
    await newGroup.save();

    return res.status(201).json({
      message: 'Academic group created successfully',
      group: { id: newGroup._id, name: newGroup.name, courseCode: newGroup.ownerId, type: newGroup.type }
    });
  } catch (error) {
    console.error('Error creating academic group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getAcademicGroupById = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group || group.type !== 'TEACHER') {
      return res.status(404).json({ message: 'Academic group not found' });
    }

    if (req.user.role === 'TEACHER' && !req.user.groups.map(g => g.toString()).includes(groupId)) {
      return res.status(403).json({ message: 'TEACHER can only access assigned groups' });
    }

    const subscriberCount = await Subscription.countDocuments({ groupId: group._id });
    const subscribers = await Subscription.find({ groupId: group._id })
      .populate('studentId', 'name email rollNo department');

    return res.json({
      message: 'Academic group retrieved successfully',
      group: {
        id: group._id,
        name: group.name,
        courseCode: group.ownerId,
        type: group.type,
        studentCount: subscriberCount,
        students: subscribers.map(s => ({
          studentId: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.email,
          rollNo: s.studentId.rollNo,
          department: s.studentId.department
        })),
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting academic group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.updateAcademicGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { name, ownerId } = req.body;

    const group = await Group.findById(groupId);
    if (!group || group.type !== 'TEACHER') {
      return res.status(404).json({ message: 'Academic group not found' });
    }

    if (req.user.role === 'TEACHER') {
      return res.status(403).json({ message: 'TEACHER cannot modify academic groups' });
    }

    if (name) group.name = name;
    if (ownerId) group.ownerId = ownerId;
    await group.save();

    return res.json({
      message: 'Academic group updated successfully',
      group: { id: group._id, name: group.name, courseCode: group.ownerId, type: group.type }
    });
  } catch (error) {
    console.error('Error updating academic group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.deleteAcademicGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findByIdAndDelete(groupId);
    if (!group || group.type !== 'TEACHER') {
      return res.status(404).json({ message: 'Academic group not found' });
    }

    await Subscription.deleteMany({ groupId });

    return res.json({
      message: 'Academic group deleted successfully',
      deletedGroup: { id: group._id, name: group.name, courseCode: group.ownerId }
    });
  } catch (error) {
    console.error('Error deleting academic group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.fireAcademicEvent = async (req, res) => {
  try {
    const { eventType, groupId, newTime, newHall, reason } = req.body;

    const validTypes = ['CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'EXAM_POSTPONED'];
    if (!validTypes.includes(eventType)) {
      return res.status(400).json({ message: 'Invalid academic event type', validTypes });
    }

    // RBAC: TEACHER can only fire events for their assigned groups (dynamic, no hardcoding)
    if (req.user.role === 'TEACHER' && !req.user.groups.map(g => g.toString()).includes(groupId)) {
      return res.status(403).json({ message: 'TEACHER can only fire events for assigned groups' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Academic group not found' });
    }

    const subscriptions = await Subscription.find({ groupId: group._id })
      .populate('studentId', 'fcmToken email name rollNo');

    const studentIds = subscriptions.map(s => s.studentId._id);
    const fcmTokens = subscriptions
      .filter(s => s.studentId.fcmToken)
      .map(s => s.studentId.fcmToken);

    const event = new Event({
      domain: 'academics',
      type: eventType,
      groupId: group._id,
      entityId: groupId,
      metadata: { courseCode: group.ownerId, courseName: group.name, newTime, newHall, reason },
      firedBy: req.user.name,
      status: 'pending',
      deliveryStats: { total: studentIds.length, delivered: 0, failed: 0, pending: studentIds.length }
    });

    await event.save();

    if (eventQueue) {
      await eventQueue.add('academic-event', {
        eventId: event._id,
        type: eventType,
        studentIds,
        fcmTokens,
        groupId: group._id,
        courseCode: groupId,
        newTime,
        newHall,
        reason,
        timestamp: new Date()
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });
    }

    return res.status(201).json({
      message: 'Academic event fired and queued successfully',
      event: {
        id: event._id,
        type: eventType,
        domain: 'academics',
        groupId,
        reason,
        newTime,
        newHall,
        firedBy: req.user.name,
        recipients: studentIds.length,
        timestamp: event.createdAt
      },
      notification: `Event queued to notify ${studentIds.length} students in ${groupId}`,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error firing academic event:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getRecentAcademicEvents = async (req, res) => {
  try {
    const groupId = req.params.groupId;

    // RBAC: TEACHER can only access their assigned groups (dynamic, no hardcoding)
    if (req.user.role === 'TEACHER' && !req.user.groups.map(g => g.toString()).includes(groupId)) {
      return res.status(403).json({ message: 'TEACHER can only access assigned groups' });
    }

    const events = await Event.find({ domain: 'academics', entityId: groupId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type metadata status deliveryStats createdAt firedBy');

    return res.json({
      message: 'Recent academic events retrieved',
      course: groupId,
      events: events.map(e => ({
        id: e._id,
        type: e.type,
        newTime: e.metadata?.newTime,
        newHall: e.metadata?.newHall,
        status: e.status,
        delivered: e.deliveryStats?.delivered,
        failed: e.deliveryStats?.failed,
        firedBy: e.firedBy,
        timestamp: e.createdAt
      })),
      total: events.length
    });
  } catch (error) {
    console.error('Error getting academic events:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
const Subscription = require('../models/Subscription');
const Group = require('../models/Group');
const Student = require('../models/Student');

/**
 * POST /subscriptions - Subscribe a student to a group
 */
const subscribe = async (req, res) => {
  try {
    const { studentId, groupId } = req.body;

    if (!studentId || !groupId) {
      return res.status(400).json({ message: 'studentId and groupId are required' });
    }

    // STUDENT can only subscribe themselves
    if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only manage own subscriptions' });
    }

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if already subscribed
    const existing = await Subscription.findOne({ studentId, groupId });
    if (existing) {
      return res.status(400).json({ message: 'Already subscribed to this group' });
    }

    const subscription = new Subscription({ studentId, groupId });
    await subscription.save();

    return res.status(201).json({
      message: 'Subscribed successfully',
      subscription: {
        id: subscription._id,
        studentId,
        groupId,
        groupName: group.name,
        groupType: group.type,
        subscribedAt: subscription.createdAt,
      },
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /subscriptions/:id - Unsubscribe from a group
 */
const unsubscribe = async (req, res) => {
  try {
    const subscriptionId = req.params.id;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // STUDENT can only remove own subscriptions
    if (
      req.user.role === 'STUDENT' &&
      subscription.studentId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'STUDENT can only manage own subscriptions' });
    }

    await Subscription.findByIdAndDelete(subscriptionId);

    return res.json({ message: 'Unsubscribed successfully', subscriptionId });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /subscriptions/student/:studentId - Get all subscriptions for a student
 */
const getStudentSubscriptions = async (req, res) => {
  try {
    const { studentId } = req.params;

    // STUDENT can only view own subscriptions
    if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
      return res.status(403).json({ message: 'STUDENT can only view own subscriptions' });
    }

    const subscriptions = await Subscription.find({ studentId }).populate(
      'groupId',
      'name type ownerId'
    );

    return res.json({
      message: 'Subscriptions retrieved',
      studentId,
      subscriptions: subscriptions.map((s) => ({
        id: s._id,
        groupId: s.groupId._id,
        groupName: s.groupId.name,
        groupType: s.groupId.type,
        subscribedAt: s.createdAt,
      })),
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('Get subscriptions error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /subscriptions/group/:groupId - Get all subscribers of a group (Admin only)
 */
const getGroupSubscribers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const subscriptions = await Subscription.find({ groupId }).populate(
      'studentId',
      'name email rollNo department hostelBlock'
    );

    return res.json({
      message: 'Group subscribers retrieved',
      groupId,
      groupName: group.name,
      groupType: group.type,
      subscribers: subscriptions.map((s) => ({
        subscriptionId: s._id,
        studentId: s.studentId._id,
        name: s.studentId.name,
        email: s.studentId.email,
        rollNo: s.studentId.rollNo,
        department: s.studentId.department,
        hostelBlock: s.studentId.hostelBlock,
        subscribedAt: s.createdAt,
      })),
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('Get group subscribers error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getStudentSubscriptions,
  getGroupSubscribers,
};
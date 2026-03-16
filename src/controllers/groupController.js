const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');

/**
 * GET /groups - List groups based on role
 */
const getAllGroups = async (req, res) => {
  try {
    let query = {};

    const roleGroupTypeMap = {
      TEACHER: 'TEACHER',
      BUS_ADMIN: 'BUS',
      LAUNDRY_ADMIN: 'LAUNDRY',
      MESS_ADMIN: 'MESS',
    };

    // Domain admins only see their type
    if (roleGroupTypeMap[req.user.role]) {
      query.type = roleGroupTypeMap[req.user.role];
    }

    // STUDENT sees only groups they are subscribed to
    if (req.user.role === 'STUDENT') {
      const subscriptions = await Subscription.find({ studentId: req.user.id });
      const groupIds = subscriptions.map((s) => s.groupId);
      query._id = { $in: groupIds };
    }

    const groups = await Group.find(query).select('_id name type ownerId createdAt');

    return res.json({
      message: 'Groups retrieved successfully',
      role: req.user.role,
      count: groups.length,
      groups: groups.map((g) => ({
        id: g._id,
        name: g.name,
        type: g.type,
        ownerId: g.ownerId,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    console.error('Get groups error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /groups - Create a group (SUPER_ADMIN only)
 */
const createGroup = async (req, res) => {
  try {
    const { name, type, ownerId } = req.body;

    if (!name || !type || !ownerId) {
      return res.status(400).json({ message: 'name, type, and ownerId are required' });
    }

    const validTypes = ['TEACHER', 'BUS', 'LAUNDRY', 'MESS'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type', validTypes });
    }

    const existing = await Group.findOne({ name, type, ownerId });
    if (existing) {
      return res.status(400).json({ message: 'Group already exists' });
    }

    const group = new Group({ name, type, ownerId });
    await group.save();

    return res.status(201).json({
      message: 'Group created successfully',
      group: { id: group._id, name: group.name, type: group.type, ownerId: group.ownerId },
    });
  } catch (err) {
    console.error('Create group error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /groups/:id - Get specific group details
 */
const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const subscriberCount = await Subscription.countDocuments({ groupId: id });

    return res.json({
      message: 'Group retrieved',
      group: {
        id: group._id,
        name: group.name,
        type: group.type,
        ownerId: group.ownerId,
        subscriberCount,
        createdAt: group.createdAt,
      },
    });
  } catch (err) {
    console.error('Get group error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * PUT /groups/:id - Update group (SUPER_ADMIN only)
 */
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, ownerId } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (name) group.name = name;
    if (type) group.type = type;
    if (ownerId) group.ownerId = ownerId;

    await group.save();

    return res.json({
      message: 'Group updated',
      group: { id: group._id, name: group.name, type: group.type, ownerId: group.ownerId },
    });
  } catch (err) {
    console.error('Update group error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /groups/:id - Delete group (SUPER_ADMIN only)
 */
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByIdAndDelete(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Cascade delete subscriptions
    await Subscription.deleteMany({ groupId: id });

    return res.json({
      message: 'Group deleted successfully',
      deletedGroup: { id: group._id, name: group.name },
    });
  } catch (err) {
    console.error('Delete group error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /groups/:id/members - Get all members of a group
 */
const getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const subscriptions = await Subscription.find({ groupId: id }).populate(
      'studentId',
      'name email rollNo department hostelBlock'
    );

    return res.json({
      message: 'Group members retrieved',
      groupId: id,
      groupName: group.name,
      members: subscriptions.map((s) => ({
        studentId: s.studentId._id,
        name: s.studentId.name,
        email: s.studentId.email,
        rollNo: s.studentId.rollNo,
        department: s.studentId.department,
        hostelBlock: s.studentId.hostelBlock,
      })),
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('Get group members error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * POST /groups/:id/members - Add a student to a group (SUPER_ADMIN only)
 */
const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const existing = await Subscription.findOne({ studentId, groupId: id });
    if (existing) {
      return res.status(400).json({ message: 'Student is already a member of this group' });
    }

    const subscription = new Subscription({ studentId, groupId: id });
    await subscription.save();

    return res.status(201).json({
      message: 'Member added to group',
      groupId: id,
      studentId,
    });
  } catch (err) {
    console.error('Add member error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * DELETE /groups/:id/members/:studentId - Remove a student from a group (SUPER_ADMIN only)
 */
const removeMember = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const deleted = await Subscription.findOneAndDelete({ groupId: id, studentId });
    if (!deleted) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    return res.json({
      message: 'Member removed from group',
      groupId: id,
      studentId,
    });
  } catch (err) {
    console.error('Remove member error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getAllGroups,
  createGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addMember,
  removeMember,
};
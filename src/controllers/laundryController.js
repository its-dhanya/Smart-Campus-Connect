const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const Event = require('../models/Event'); // Assuming event model exists
const eventQueue = require('../queue/eventQueue'); // For BullMQ

/**
 * LAUNDRY CONTROLLER
 * Handles all laundry-domain specific operations
 * Laundry Admins manage: Block A (HOSTEL-A) with 3 washing machines (GRP004)
 */

/**
 * GET /laundry - List all laundry groups
 * LAUNDRY_ADMIN: sees only Block A
 * SUPER_ADMIN: sees all blocks
 */
exports.getAllLaundryGroups = async (req, res) => {
  try {
    let query = { type: 'LAUNDRY' };

    // If LAUNDRY_ADMIN, filter to assigned block only
    if (req.user.role === 'LAUNDRY_ADMIN') {
      query.ownerId = 'HOSTEL-A'; // Block A only
    }

    const groups = await Group.find(query).select('_id name ownerId type createdAt');

    return res.json({
      message: 'Laundry groups retrieved successfully',
      role: req.user.role,
      accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all blocks' : 'assigned block only',
      count: groups.length,
      groups: groups.map(g => ({
        id: g._id,
        name: g.name,
        block: g.ownerId,
        type: g.type,
        createdAt: g.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting laundry groups:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /laundry - Create laundry group (SUPER_ADMIN ONLY)
 */
exports.createLaundryGroup = async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    // Validation
    if (!name || !ownerId) {
      return res.status(400).json({ message: 'Name and ownerId are required' });
    }

    // Check if group already exists
    const existingGroup = await Group.findOne({ name, ownerId, type: 'LAUNDRY' });
    if (existingGroup) {
      return res.status(400).json({ message: 'Laundry group already exists' });
    }

    // Create new group
    const newGroup = new Group({
      name: name,
      ownerId: ownerId,
      type: 'LAUNDRY'
    });

    await newGroup.save();

    return res.status(201).json({
      message: 'Laundry group created successfully',
      group: {
        id: newGroup._id,
        name: newGroup.name,
        block: newGroup.ownerId,
        type: newGroup.type
      }
    });
  } catch (error) {
    console.error('Error creating laundry group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /laundry/:id - Get specific laundry group details
 */
exports.getLaundryGroupById = async (req, res) => {
  try {
    const blockId = req.params.id;

    const group = await Group.findById(blockId);
    if (!group || group.type !== 'LAUNDRY') {
      return res.status(404).json({ message: 'Laundry group not found' });
    }

    // RBAC: LAUNDRY_ADMIN can only access Block A
    if (req.user.role === 'LAUNDRY_ADMIN' && group.ownerId !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only access assigned block (Block A)'
      });
    }

    // Get subscriber count
    const subscriberCount = await Subscription.countDocuments({ groupId: group._id });

    // Get subscribers details
    const subscribers = await Subscription.find({ groupId: group._id })
      .populate('studentId', 'name email rollNo')
      .select('studentId -_id');

    return res.json({
      message: 'Laundry group retrieved successfully',
      group: {
        id: group._id,
        name: group.name,
        block: group.ownerId,
        type: group.type,
        subscriberCount: subscriberCount,
        subscribers: subscribers.map(s => ({
          studentId: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.email,
          rollNo: s.studentId.rollNo
        })),
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting laundry group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /laundry/:id - Update laundry group
 */
exports.updateLaundryGroup = async (req, res) => {
  try {
    const blockId = req.params.id;
    const { name, ownerId } = req.body;

    const group = await Group.findById(blockId);
    if (!group || group.type !== 'LAUNDRY') {
      return res.status(404).json({ message: 'Laundry group not found' });
    }

    // RBAC: LAUNDRY_ADMIN can only update Block A
    if (req.user.role === 'LAUNDRY_ADMIN' && group.ownerId !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only update assigned block (Block A)'
      });
    }

    // Update fields
    if (name) group.name = name;
    if (ownerId && req.user.role === 'SUPER_ADMIN') group.ownerId = ownerId;

    await group.save();

    return res.json({
      message: 'Laundry group updated successfully',
      group: {
        id: group._id,
        name: group.name,
        block: group.ownerId,
        type: group.type
      }
    });
  } catch (error) {
    console.error('Error updating laundry group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /laundry/:id - Delete laundry group (SUPER_ADMIN ONLY)
 */
exports.deleteLaundryGroup = async (req, res) => {
  try {
    const blockId = req.params.id;

    const group = await Group.findByIdAndDelete(blockId);
    if (!group || group.type !== 'LAUNDRY') {
      return res.status(404).json({ message: 'Laundry group not found' });
    }

    // Also delete all subscriptions for this group
    await Subscription.deleteMany({ groupId: blockId });

    return res.json({
      message: 'Laundry group deleted successfully',
      deletedGroup: {
        id: group._id,
        name: group.name,
        block: group.ownerId
      }
    });
  } catch (error) {
    console.error('Error deleting laundry group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /laundry/event - Fire laundry event
 * Event types: WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, WASH_MACHINE_STARTED, WASH_SLOT_BOOKED
 */
exports.fireLaundryEvent = async (req, res) => {
  try {
    const { eventType, machine, blockId, reason } = req.body;

    // Validate event type
    const validTypes = ['WASH_MACHINE_COMPLETED', 'WASH_SLOT_CANCELLED', 'WASH_MACHINE_STARTED', 'WASH_SLOT_BOOKED'];
    if (!validTypes.includes(eventType)) {
      return res.status(400).json({ 
        message: 'Invalid laundry event type',
        validTypes: validTypes
      });
    }

    // RBAC: LAUNDRY_ADMIN can only fire events for Block A
    const targetBlock = blockId || 'HOSTEL-A';
    if (req.user.role === 'LAUNDRY_ADMIN' && targetBlock !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only fire events for assigned block (Block A)',
        assignedBlock: 'HOSTEL-A'
      });
    }

    // Get the group (GRP004 for Block A)
    const group = await Group.findOne({ ownerId: targetBlock, type: 'LAUNDRY' });
    if (!group) {
      return res.status(404).json({ message: 'Laundry group not found' });
    }

    // Get all students subscribed to this group
    const subscriptions = await Subscription.find({ groupId: group._id })
      .populate('studentId', 'fcmToken email name');

    const studentIds = subscriptions.map(s => s.studentId._id);
    const fcmTokens = subscriptions
      .filter(s => s.studentId.fcmToken)
      .map(s => s.studentId.fcmToken);

    // Create event record
    const event = new Event({
      domain: 'laundry',
      type: eventType,
      groupId: group._id,
      entityId: targetBlock,
      metadata: {
        machine: machine,
        block: targetBlock,
        reason: reason
      },
      firedBy: req.user.name,
      status: 'pending',
      deliveryStats: {
        total: studentIds.length,
        delivered: 0,
        failed: 0,
        pending: studentIds.length
      }
    });

    await event.save();

    // Queue the event for BullMQ processing
    if (eventQueue) {
      await eventQueue.add('laundry-event', {
        eventId: event._id,
        type: eventType,
        studentIds: studentIds,
        fcmTokens: fcmTokens,
        groupId: group._id,
        blockId: targetBlock,
        machine: machine,
        reason: reason,
        timestamp: new Date()
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    }

    return res.status(201).json({
      message: 'Laundry event fired and queued successfully',
      event: {
        id: event._id,
        type: eventType,
        domain: 'laundry',
        block: targetBlock,
        machine: machine,
        groupId: group._id,
        reason: reason,
        firedBy: req.user.name,
        recipients: studentIds.length,
        timestamp: event.createdAt
      },
      notification: `Event queued to notify ${studentIds.length} students in ${targetBlock}`,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error firing laundry event:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /laundry/machines/:blockId - Get machine status for a block
 * Useful for displaying machine availability
 */
exports.getMachineStatus = async (req, res) => {
  try {
    const blockId = req.params.blockId || 'HOSTEL-A';

    // RBAC: LAUNDRY_ADMIN can only access Block A
    if (req.user.role === 'LAUNDRY_ADMIN' && blockId !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only access assigned block (Block A)'
      });
    }

    // Return machine status (mock data - implement with actual machine data)
    const machines = [
      { id: 1, name: 'Machine 1', block: blockId, status: 'free', lastUsed: '2 hrs ago' },
      { id: 2, name: 'Machine 2', block: blockId, status: 'in-use', lastUsed: '5 mins ago' },
      { id: 3, name: 'Machine 3', block: blockId, status: 'free', lastUsed: '1 hr ago' }
    ];

    return res.json({
      message: 'Machine status retrieved',
      block: blockId,
      machines: machines,
      availableMachines: machines.filter(m => m.status === 'free').length,
      inUseMachines: machines.filter(m => m.status === 'in-use').length
    });
  } catch (error) {
    console.error('Error getting machine status:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /laundry/events/:blockId - Get recent laundry events for a block
 */
exports.getRecentLaundryEvents = async (req, res) => {
  try {
    const blockId = req.params.blockId || 'HOSTEL-A';

    // RBAC: LAUNDRY_ADMIN can only access Block A
    if (req.user.role === 'LAUNDRY_ADMIN' && blockId !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only access assigned block (Block A)'
      });
    }

    const events = await Event.find({
      domain: 'laundry',
      'metadata.block': blockId
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type metadata status deliveryStats createdAt firedBy');

    return res.json({
      message: 'Recent laundry events retrieved',
      block: blockId,
      events: events.map(e => ({
        id: e._id,
        type: e.type,
        machine: e.metadata?.machine,
        status: e.status,
        delivered: e.deliveryStats?.delivered,
        failed: e.deliveryStats?.failed,
        firedBy: e.firedBy,
        timestamp: e.createdAt
      })),
      total: events.length
    });
  } catch (error) {
    console.error('Error getting laundry events:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
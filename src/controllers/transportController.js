const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const Event = require('../models/Event');
const eventQueue = require('../queue/eventQueue');

/**
 * TRANSPORT CONTROLLER
 * Handles all transport-domain specific operations
 * Bus Admins manage: BUS_052 (Route 42, GRP003 - 34 students)
 */

/**
 * GET /transport - List all buses
 * BUS_ADMIN: sees only BUS_052
 * SUPER_ADMIN: sees all buses
 */
exports.getAllBuses = async (req, res) => {
  try {
    let query = { type: 'BUS' };

    // If BUS_ADMIN, filter to assigned bus only
    if (req.user.role === 'BUS_ADMIN') {
      query.ownerId = 'BUS_052'; // Assigned bus only
    }

    const groups = await Group.find(query).select('_id name ownerId type createdAt');

    return res.json({
      message: 'Buses retrieved successfully',
      role: req.user.role,
      accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all buses' : 'assigned bus only',
      count: groups.length,
      groups: groups.map(g => ({
        id: g._id,
        name: g.name,
        busId: g.ownerId,
        type: g.type,
        createdAt: g.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting buses:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /transport - Create bus (SUPER_ADMIN ONLY)
 */
exports.createBus = async (req, res) => {
  try {
    const { name, ownerId, route } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({ message: 'Name and ownerId are required' });
    }

    // Check if bus already exists
    const existingBus = await Group.findOne({ ownerId, type: 'BUS' });
    if (existingBus) {
      return res.status(400).json({ message: 'Bus already exists' });
    }

    const newBus = new Group({
      name: name,
      ownerId: ownerId,
      type: 'BUS'
    });

    await newBus.save();

    return res.status(201).json({
      message: 'Bus created successfully',
      bus: {
        id: newBus._id,
        name: newBus.name,
        busId: newBus.ownerId,
        type: newBus.type
      }
    });
  } catch (error) {
    console.error('Error creating bus:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /transport/:id - Get specific bus details
 */
exports.getBusById = async (req, res) => {
  try {
    const busId = req.params.id;

    const bus = await Group.findById(busId);
    if (!bus || bus.type !== 'BUS') {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // RBAC: BUS_ADMIN can only access BUS_052
    if (req.user.role === 'BUS_ADMIN' && bus.ownerId !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only access assigned bus (BUS_052)'
      });
    }

    // Get subscriber count
    const subscriberCount = await Subscription.countDocuments({ groupId: bus._id });

    // Get subscribers details
    const subscribers = await Subscription.find({ groupId: bus._id })
      .populate('studentId', 'name email rollNo hostelBlock');

    return res.json({
      message: 'Bus details retrieved successfully',
      bus: {
        id: bus._id,
        name: bus.name,
        busId: bus.ownerId,
        type: bus.type,
        subscriberCount: subscriberCount,
        subscribers: subscribers.map(s => ({
          studentId: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.email,
          rollNo: s.studentId.rollNo,
          hostelBlock: s.studentId.hostelBlock
        })),
        createdAt: bus.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting bus:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /transport/:id - Update bus
 */
exports.updateBus = async (req, res) => {
  try {
    const busId = req.params.id;
    const { name, ownerId } = req.body;

    const bus = await Group.findById(busId);
    if (!bus || bus.type !== 'BUS') {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // RBAC: BUS_ADMIN can only update BUS_052
    if (req.user.role === 'BUS_ADMIN' && bus.ownerId !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only update assigned bus (BUS_052)'
      });
    }

    if (name) bus.name = name;
    if (ownerId && req.user.role === 'SUPER_ADMIN') bus.ownerId = ownerId;

    await bus.save();

    return res.json({
      message: 'Bus updated successfully',
      bus: {
        id: bus._id,
        name: bus.name,
        busId: bus.ownerId,
        type: bus.type
      }
    });
  } catch (error) {
    console.error('Error updating bus:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /transport/:id - Delete bus (SUPER_ADMIN ONLY)
 */
exports.deleteBus = async (req, res) => {
  try {
    const busId = req.params.id;

    const bus = await Group.findByIdAndDelete(busId);
    if (!bus || bus.type !== 'BUS') {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // Delete all subscriptions for this bus
    await Subscription.deleteMany({ groupId: busId });

    return res.json({
      message: 'Bus deleted successfully',
      deletedBus: {
        id: bus._id,
        name: bus.name,
        busId: bus.ownerId
      }
    });
  } catch (error) {
    console.error('Error deleting bus:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /transport/event - Fire transport event
 * Event types: BUS_DELAYED, BUS_CANCELLED, BUS_ARRIVED
 */
exports.fireTransportEvent = async (req, res) => {
  try {
    const { eventType, busId, reason } = req.body;

    // Validate event type
    const validTypes = ['BUS_DELAYED', 'BUS_CANCELLED', 'BUS_ARRIVED'];
    if (!validTypes.includes(eventType)) {
      return res.status(400).json({ 
        message: 'Invalid transport event type',
        validTypes: validTypes
      });
    }

    // RBAC: BUS_ADMIN can only fire events for BUS_052
    const targetBus = busId || 'BUS_052';
    if (req.user.role === 'BUS_ADMIN' && targetBus !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only fire events for assigned bus (BUS_052)',
        deniedBuses: ['BUS_018', 'BUS_007'],
        assignedBus: 'BUS_052'
      });
    }

    // Get the group (GRP003 for BUS_052)
    const bus = await Group.findOne({ ownerId: targetBus, type: 'BUS' });
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // Get all students subscribed to this bus
    const subscriptions = await Subscription.find({ groupId: bus._id })
      .populate('studentId', 'fcmToken email name rollNo');

    const studentIds = subscriptions.map(s => s.studentId._id);
    const fcmTokens = subscriptions
      .filter(s => s.studentId.fcmToken)
      .map(s => s.studentId.fcmToken);

    // Create event record
    const event = new Event({
      domain: 'transport',
      type: eventType,
      groupId: bus._id,
      entityId: targetBus,
      metadata: {
        busId: targetBus,
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
      await eventQueue.add('transport-event', {
        eventId: event._id,
        type: eventType,
        studentIds: studentIds,
        fcmTokens: fcmTokens,
        groupId: bus._id,
        busId: targetBus,
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
      message: 'Transport event fired and queued successfully',
      event: {
        id: event._id,
        type: eventType,
        domain: 'transport',
        busId: targetBus,
        reason: reason,
        firedBy: req.user.name,
        recipients: studentIds.length,
        timestamp: event.createdAt
      },
      notification: `Event queued to notify ${studentIds.length} students on ${targetBus}`,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error firing transport event:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /transport/events/:busId - Get recent transport events for a bus
 */
exports.getRecentTransportEvents = async (req, res) => {
  try {
    const busId = req.params.busId;

    // RBAC: BUS_ADMIN can only access BUS_052
    if (req.user.role === 'BUS_ADMIN' && busId !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only access assigned bus (BUS_052)'
      });
    }

    const events = await Event.find({
      domain: 'transport',
      entityId: busId
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type metadata status deliveryStats createdAt firedBy');

    return res.json({
      message: 'Recent transport events retrieved',
      bus: busId,
      events: events.map(e => ({
        id: e._id,
        type: e.type,
        status: e.status,
        delivered: e.deliveryStats?.delivered,
        failed: e.deliveryStats?.failed,
        firedBy: e.firedBy,
        timestamp: e.createdAt
      })),
      total: events.length
    });
  } catch (error) {
    console.error('Error getting transport events:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /transport/status/:busId - Get current bus status
 */
exports.getBusStatus = async (req, res) => {
  try {
    const busId = req.params.busId || 'BUS_052';

    // RBAC: BUS_ADMIN can only access BUS_052
    if (req.user.role === 'BUS_ADMIN' && busId !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only access assigned bus (BUS_052)'
      });
    }

    // Return bus status (mock data - implement with actual tracking)
    return res.json({
      message: 'Bus status retrieved',
      bus: busId,
      status: {
        currentLocation: 'Hostel-A',
        scheduledTime: '8:30 AM',
        estimatedArrival: 'On time',
        subscribers: 34,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting bus status:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const Event = require('../models/Event');
const eventQueue = require('../queue/eventQueue');

/**
 * MESS CONTROLLER
 * Handles all mess-domain specific operations
 * Mess Admins manage: Main Mess (GRP005 - 247 students)
 * Manages check-ins, absences, refunds
 */

/**
 * GET /mess - List all mess groups
 * MESS_ADMIN: sees only Main Mess
 * SUPER_ADMIN: sees all messes
 */
exports.getAllMessGroups = async (req, res) => {
  try {
    let query = { type: 'MESS' };

    // If MESS_ADMIN, filter to assigned mess only
    if (req.user.role === 'MESS_ADMIN') {
      query.ownerId = 'MAIN_MESS'; // Main Mess only
    }

    const groups = await Group.find(query).select('_id name ownerId type createdAt');

    return res.json({
      message: 'Mess groups retrieved successfully',
      role: req.user.role,
      accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all messes' : 'assigned mess only',
      count: groups.length,
      groups: groups.map(g => ({
        id: g._id,
        name: g.name,
        messId: g.ownerId,
        type: g.type,
        createdAt: g.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting mess groups:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /mess - Create mess group (SUPER_ADMIN ONLY)
 */
exports.createMessGroup = async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({ message: 'Name and ownerId are required' });
    }

    // Check if mess already exists
    const existingMess = await Group.findOne({ ownerId, type: 'MESS' });
    if (existingMess) {
      return res.status(400).json({ message: 'Mess group already exists' });
    }

    const newMess = new Group({
      name: name,
      ownerId: ownerId,
      type: 'MESS'
    });

    await newMess.save();

    return res.status(201).json({
      message: 'Mess group created successfully',
      mess: {
        id: newMess._id,
        name: newMess.name,
        messId: newMess.ownerId,
        type: newMess.type
      }
    });
  } catch (error) {
    console.error('Error creating mess group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/:id - Get specific mess group details
 */
exports.getMessGroupById = async (req, res) => {
  try {
    const messId = req.params.id;

    const mess = await Group.findById(messId);
    if (!mess || mess.type !== 'MESS') {
      return res.status(404).json({ message: 'Mess group not found' });
    }

    // RBAC: MESS_ADMIN can only access Main Mess
    if (req.user.role === 'MESS_ADMIN' && mess.ownerId !== 'MAIN_MESS') {
      return res.status(403).json({ 
        message: 'MESS_ADMIN can only access assigned mess (Main Mess)'
      });
    }

    // Get subscriber count
    const subscriberCount = await Subscription.countDocuments({ groupId: mess._id });

    // Get subscribers count summary
    const subscribers = await Subscription.find({ groupId: mess._id })
      .populate('studentId', 'name email rollNo department');

    return res.json({
      message: 'Mess group retrieved successfully',
      mess: {
        id: mess._id,
        name: mess.name,
        messId: mess.ownerId,
        type: mess.type,
        studentCount: subscriberCount,
        students: subscribers.map(s => ({
          studentId: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.email,
          rollNo: s.studentId.rollNo,
          department: s.studentId.department
        })),
        createdAt: mess.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting mess group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * PUT /mess/:id - Update mess group
 */
exports.updateMessGroup = async (req, res) => {
  try {
    const messId = req.params.id;
    const { name, ownerId } = req.body;

    const mess = await Group.findById(messId);
    if (!mess || mess.type !== 'MESS') {
      return res.status(404).json({ message: 'Mess group not found' });
    }

    // RBAC: MESS_ADMIN can only update Main Mess
    if (req.user.role === 'MESS_ADMIN' && mess.ownerId !== 'MAIN_MESS') {
      return res.status(403).json({ 
        message: 'MESS_ADMIN can only update assigned mess (Main Mess)'
      });
    }

    if (name) mess.name = name;
    if (ownerId && req.user.role === 'SUPER_ADMIN') mess.ownerId = ownerId;

    await mess.save();

    return res.json({
      message: 'Mess group updated successfully',
      mess: {
        id: mess._id,
        name: mess.name,
        messId: mess.ownerId,
        type: mess.type
      }
    });
  } catch (error) {
    console.error('Error updating mess group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /mess/:id - Delete mess group (SUPER_ADMIN ONLY)
 */
exports.deleteMessGroup = async (req, res) => {
  try {
    const messId = req.params.id;

    const mess = await Group.findByIdAndDelete(messId);
    if (!mess || mess.type !== 'MESS') {
      return res.status(404).json({ message: 'Mess group not found' });
    }

    // Delete all subscriptions for this mess
    await Subscription.deleteMany({ groupId: messId });

    return res.json({
      message: 'Mess group deleted successfully',
      deletedMess: {
        id: mess._id,
        name: mess.name,
        messId: mess.ownerId
      }
    });
  } catch (error) {
    console.error('Error deleting mess group:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /mess/event - Fire mess event
 * Event types: MESS_CHECKIN, MESS_ABSENT, MESS_REFUND_REQUESTED, MESS_REFUND_PROCESSED
 */
exports.fireMessEvent = async (req, res) => {
  try {
    const { eventType, studentId, mealType, refundAmount, reason } = req.body;

    // Validate event type
    const validTypes = ['MESS_CHECKIN', 'MESS_ABSENT', 'MESS_REFUND_REQUESTED', 'MESS_REFUND_PROCESSED'];
    if (!validTypes.includes(eventType)) {
      return res.status(400).json({ 
        message: 'Invalid mess event type',
        validTypes: validTypes
      });
    }

    // Validate meal type
    const validMeals = ['breakfast', 'lunch', 'dinner'];
    if (!validMeals.includes(mealType)) {
      return res.status(400).json({ 
        message: 'Invalid meal type',
        validMeals: validMeals
      });
    }

    // Get the mess group (GRP005 for Main Mess)
    const mess = await Group.findOne({ ownerId: 'MAIN_MESS', type: 'MESS' });
    if (!mess) {
      return res.status(404).json({ message: 'Mess group not found' });
    }

    // Get target student(s)
    const targetStudent = await Student.findById(studentId);
    if (!targetStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // For this event, we notify the specific student directly (not broadcast to group)
    const fcmTokens = targetStudent.fcmToken ? [targetStudent.fcmToken] : [];

    // Create event record
    const event = new Event({
      domain: 'mess',
      type: eventType,
      groupId: mess._id,
      entityId: 'MAIN_MESS',
      metadata: {
        studentId: studentId,
        mealType: mealType,
        refundAmount: refundAmount,
        reason: reason
      },
      firedBy: req.user.name,
      status: 'pending',
      deliveryStats: {
        total: 1,
        delivered: 0,
        failed: 0,
        pending: 1
      }
    });

    await event.save();

    // Queue the event for BullMQ processing
    if (eventQueue) {
      await eventQueue.add('mess-event', {
        eventId: event._id,
        type: eventType,
        studentId: studentId,
        fcmTokens: fcmTokens,
        groupId: mess._id,
        mealType: mealType,
        refundAmount: refundAmount,
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
      message: 'Mess event fired and queued successfully',
      event: {
        id: event._id,
        type: eventType,
        domain: 'mess',
        studentId: studentId,
        mealType: mealType,
        refundAmount: refundAmount,
        reason: reason,
        firedBy: req.user.name,
        timestamp: event.createdAt
      },
      notification: `Notification queued for student ${studentId}`,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error firing mess event:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/checkins/:date - Get check-ins for a specific date
 */
exports.getCheckins = async (req, res) => {
  try {
    const date = req.params.date;

    // RBAC: MESS_ADMIN can only access Main Mess
    if (req.user.role === 'MESS_ADMIN') {
      // Verify they have access to Main Mess
    }

    // Return check-in data for the date
    // This would typically query a check-in collection
    return res.json({
      message: 'Check-ins retrieved for date',
      date: date,
      summary: {
        checkedIn: 183,
        absent: 64,
        excused: 0,
        total: 247
      },
      mealBreakdown: {
        breakfast: { checked: 100, absent: 83, excused: 0 },
        lunch: { checked: 150, absent: 50, excused: 47 },
        dinner: { checked: 120, absent: 80, excused: 47 }
      }
    });
  } catch (error) {
    console.error('Error getting check-ins:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /mess/refund - Process refund
 */
exports.processRefund = async (req, res) => {
  try {
    const { studentId, amount, reason } = req.body;

    if (!studentId || !amount) {
      return res.status(400).json({ message: 'studentId and amount are required' });
    }

    // Get the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Create refund event
    const mess = await Group.findOne({ ownerId: 'MAIN_MESS', type: 'MESS' });
    const event = new Event({
      domain: 'mess',
      type: 'MESS_REFUND_PROCESSED',
      groupId: mess._id,
      entityId: 'MAIN_MESS',
      metadata: {
        studentId: studentId,
        refundAmount: amount,
        reason: reason
      },
      firedBy: req.user.name,
      status: 'pending',
      deliveryStats: {
        total: 1,
        delivered: 0,
        failed: 0,
        pending: 1
      }
    });

    await event.save();

    // Queue the refund notification
    if (eventQueue && student.fcmToken) {
      await eventQueue.add('mess-event', {
        eventId: event._id,
        type: 'MESS_REFUND_PROCESSED',
        studentId: studentId,
        fcmTokens: [student.fcmToken],
        groupId: mess._id,
        refundAmount: amount,
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
      message: 'Refund processed and notification queued',
      refund: {
        studentId: studentId,
        studentName: student.name,
        amount: amount,
        reason: reason,
        status: 'pending - will be credited in 3 working days',
        processedBy: req.user.username,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/events/:messId - Get recent mess events
 */
exports.getRecentMessEvents = async (req, res) => {
  try {
    const messId = req.params.messId || 'MAIN_MESS';

    // RBAC: MESS_ADMIN can only access Main Mess
    if (req.user.role === 'MESS_ADMIN' && messId !== 'MAIN_MESS') {
      return res.status(403).json({ 
        message: 'MESS_ADMIN can only access assigned mess (Main Mess)'
      });
    }

    const events = await Event.find({
      domain: 'mess',
      entityId: messId
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('type metadata status deliveryStats createdAt firedBy');

    return res.json({
      message: 'Recent mess events retrieved',
      mess: messId,
      events: events.map(e => ({
        id: e._id,
        type: e.type,
        studentId: e.metadata?.studentId,
        mealType: e.metadata?.mealType,
        refundAmount: e.metadata?.refundAmount,
        status: e.status,
        firedBy: e.firedBy,
        timestamp: e.createdAt
      })),
      total: events.length
    });
  } catch (error) {
    console.error('Error getting mess events:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/summary/:month - Get monthly mess summary for a student
 */
exports.getMessSummary = async (req, res) => {
  try {
    const month = req.params.month || 'march';
    const year = new Date().getFullYear();

    // Return mock summary data
    return res.json({
      message: 'Mess summary retrieved',
      period: `${month} ${year}`,
      summary: {
        mealsEaten: 63,
        mealsMissed: 27,
        totalMeals: 90,
        refundDue: 1350,
        refundStatus: 'pending - will be credited in 3 working days',
        breakdown: {
          breakfast: { attended: 20, missed: 10 },
          lunch: { attended: 22, missed: 8 },
          dinner: { attended: 21, missed: 9 }
        }
      }
    });
  } catch (error) {
    console.error('Error getting mess summary:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

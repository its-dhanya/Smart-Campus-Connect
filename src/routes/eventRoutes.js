const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const eventController = require('../controllers/eventController');

/**
 * EVENT ROUTES (Role-based event firing)
 * 
 * Event domains and who can fire them:
 * - TRANSPORT (BUS_ADMIN): BUS_DELAYED, BUS_CANCELLED, BUS_ARRIVED
 * - ACADEMICS (TEACHER): CLASS_CANCELLED, CLASS_RESCHEDULED, EXAM_POSTPONED
 * - LAUNDRY (LAUNDRY_ADMIN): WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, etc.
 * - MESS (MESS_ADMIN): MESS_CHECKIN, MESS_ABSENT, MESS_REFUND_REQUESTED, MESS_REFUND_PROCESSED
 * 
 * SUPER_ADMIN can fire events in any domain
 */

// POST /events - Fire/publish an event (domain admin only + SUPER_ADMIN)
router.post('/', verifyToken, (req, res) => {
  const { domain, type, groupId, entityId, reason, data } = req.body;

  // Validate domain
  const validDomains = ['transport', 'academics', 'laundry', 'mess'];
  if (!validDomains.includes(domain)) {
    return res.status(400).json({ message: 'Invalid domain' });
  }

  // Check role-based access
  const domainRoleMap = {
    'transport': ['BUS_ADMIN', 'SUPER_ADMIN'],
    'academics': ['TEACHER', 'SUPER_ADMIN'],
    'laundry': ['LAUNDRY_ADMIN', 'SUPER_ADMIN'],
    'mess': ['MESS_ADMIN', 'SUPER_ADMIN']
  };

  if (!domainRoleMap[domain]?.includes(req.user.role)) {
    return res.status(403).json({ 
      message: `${req.user.role} cannot fire ${domain} events`,
      allowedRoles: domainRoleMap[domain]
    });
  }

  // Domain-specific validations
  const validTypes = {
    'transport': ['BUS_DELAYED', 'BUS_CANCELLED', 'BUS_ARRIVED'],
    'academics': ['CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'EXAM_POSTPONED'],
    'laundry': ['WASH_MACHINE_COMPLETED', 'WASH_SLOT_CANCELLED', 'WASH_MACHINE_STARTED', 'WASH_SLOT_BOOKED'],
    'mess': ['MESS_CHECKIN', 'MESS_ABSENT', 'MESS_REFUND_REQUESTED', 'MESS_REFUND_PROCESSED']
  };

  if (!validTypes[domain]?.includes(type)) {
    return res.status(400).json({ 
      message: 'Invalid event type for domain',
      validTypes: validTypes[domain]
    });
  }

  // Additional RBAC checks based on entity/group assignment
  if (req.user.role === 'BUS_ADMIN' && domain === 'transport') {
    if (entityId !== 'BUS_052') {
      return res.status(403).json({ message: 'BUS_ADMIN can only fire events for assigned bus (BUS_052)' });
    }
  }

  if (req.user.role === 'TEACHER' && domain === 'academics') {
    const allowedGroups = ['GRP001', 'GRP002'];
    if (!allowedGroups.includes(groupId)) {
      return res.status(403).json({ message: 'TEACHER can only fire events for assigned groups (GRP001, GRP002)' });
    }
  }

  if (req.user.role === 'LAUNDRY_ADMIN' && domain === 'laundry') {
    if (entityId && entityId !== 'HOSTEL-A') {
      return res.status(403).json({ message: 'LAUNDRY_ADMIN can only fire events for assigned block (HOSTEL-A)' });
    }
  }

  if (req.user.role === 'MESS_ADMIN' && domain === 'mess') {
    if (entityId && entityId !== 'MAIN_MESS') {
      return res.status(403).json({ message: 'MESS_ADMIN can only fire events for assigned mess (MAIN_MESS)' });
    }
  }

  res.json({
    message: 'Event fired successfully',
    event: {
      id: `EVT_${Date.now()}`,
      domain: domain,
      type: type,
      groupId: groupId || 'N/A',
      entityId: entityId || 'N/A',
      reason: reason || '',
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    queued: true,
    notification: `Event will be delivered to subscribed students via BullMQ worker`
  });
});

// GET /events - Get events (filterable by domain, type, timestamp)
router.get('/', verifyToken, (req, res) => {
  const { domain, type, startDate, endDate } = req.query;
  
  // STUDENT can only see events they're subscribed to
  // Domain admins can see events in their domain
  // SUPER_ADMIN can see all events

  res.json({ 
    message: 'Get events',
    filters: {
      domain: domain || 'all',
      type: type || 'all',
      startDate: startDate || '2026-03-01',
      endDate: endDate || '2026-03-11'
    },
    role: req.user.role,
    events: [
      { id: 'EVT_001', domain: 'transport', type: 'BUS_DELAYED', groupId: 'GRP003', timestamp: '2026-03-11T14:30:00Z' },
      { id: 'EVT_002', domain: 'academics', type: 'CLASS_CANCELLED', groupId: 'GRP001', timestamp: '2026-03-11T13:00:00Z' }
    ]
  });
});

// GET /events/:id - Get event details
router.get('/:id', verifyToken, (req, res) => {
  const eventId = req.params.id;
  
  res.json({ 
    message: 'Get event details',
    event: {
      id: eventId,
      domain: 'transport',
      type: 'BUS_DELAYED',
      groupId: 'GRP003',
      entityId: 'BUS_052',
      reason: 'Heavy traffic on Ring Road',
      firedBy: 'Ravi Kumar',
      timestamp: new Date().toISOString(),
      deliveryStatus: 'in_progress',
      delivered: 28,
      failed: 0,
      pending: 6
    }
  });
});

// GET /events/domain/:domain - Get events by domain
router.get('/domain/:domain', verifyToken, (req, res) => {
  const domain = req.params.domain;
  
  // Validate domain
  const validDomains = ['transport', 'academics', 'laundry', 'mess'];
  if (!validDomains.includes(domain)) {
    return res.status(400).json({ message: 'Invalid domain' });
  }

  // Check access
  const domainRoleMap = {
    'transport': ['BUS_ADMIN', 'SUPER_ADMIN'],
    'academics': ['TEACHER', 'SUPER_ADMIN'],
    'laundry': ['LAUNDRY_ADMIN', 'SUPER_ADMIN'],
    'mess': ['MESS_ADMIN', 'SUPER_ADMIN']
  };

  // STUDENT should not access this, they can only access through their subscriptions
  if (req.user.role === 'STUDENT') {
    return res.status(403).json({ message: 'STUDENT cannot access domain events directly' });
  }

  if (!domainRoleMap[domain]?.includes(req.user.role)) {
    return res.status(403).json({ message: `You do not have access to ${domain} events` });
  }

  res.json({
    message: `Get ${domain} events`,
    domain: domain,
    events: [
      { id: 'EVT_101', type: 'BUS_DELAYED', timestamp: '2026-03-11T14:30:00Z' },
      { id: 'EVT_102', type: 'BUS_ARRIVED', timestamp: '2026-03-11T13:00:00Z' }
    ],
    total: 2
  });
});

// GET /events/queue/status - Get BullMQ queue status (SUPER_ADMIN only)
router.get('/queue/status', verifyToken, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can view queue status' });
  }

  res.json({
    message: 'Queue status',
    queue: {
      waiting: 5,
      active: 12,
      completed: 142,
      failed: 2,
      totalDepth: 5
    }
  });
});

module.exports = router;

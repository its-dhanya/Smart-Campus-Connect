const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const transportController = require('../controllers/transportController');

/**
 * TRANSPORT ROUTES (BUS_ADMIN + SUPER_ADMIN)
 * Bus Admins can only manage their assigned bus (BUS_052 for Ravi Kumar - GRP003)
 * Cannot access other buses (BUS_018, BUS_007)
 */

// GET /transport - List all buses (BUS_ADMIN + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  // BUS_ADMIN sees only their bus, SUPER_ADMIN sees all
  res.json({ 
    message: 'Get all buses',
    role: req.user.role,
    accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all buses' : 'assigned bus only (BUS_052)'
  });
});

// POST /transport - Create bus route (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can create bus routes' });
  }
  res.json({ message: 'Create bus route - SUPER_ADMIN only' });
});

// GET /transport/:id - Get specific bus details (BUS_ADMIN + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  // If BUS_ADMIN, check they own this bus
  const busId = req.params.id;
  if (req.user.role === 'BUS_ADMIN' && busId !== 'BUS_052') {
    return res.status(403).json({ message: 'BUS_ADMIN can only access assigned bus (BUS_052)' });
  }
  
  res.json({ 
    message: 'Get bus details',
    busId: busId,
    role: req.user.role
  });
});

// PUT /transport/:id - Update bus route (BUS_ADMIN assigned only)
router.put('/:id', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  const busId = req.params.id;
  
  // Only SUPER_ADMIN or the assigned BUS_ADMIN can update
  if (req.user.role === 'BUS_ADMIN' && busId !== 'BUS_052') {
    return res.status(403).json({ message: 'BUS_ADMIN can only update assigned bus (BUS_052)' });
  }
  
  res.json({ 
    message: 'Update bus route',
    busId: busId,
    role: req.user.role
  });
});

// DELETE /transport/:id - Delete bus route (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can delete bus routes' });
  }
  res.json({ message: 'Delete bus route - SUPER_ADMIN only' });
});

// POST /transport/event - Fire transport event (BUS_ADMIN + SUPER_ADMIN)
// Event types: BUS_DELAYED, BUS_CANCELLED, BUS_ARRIVED
router.post('/event', verifyToken, allowRolesWithSuper('BUS_ADMIN'), (req, res) => {
  const { eventType, busId, reason } = req.body;
  
  // Validate event type
  const validTypes = ['BUS_DELAYED', 'BUS_CANCELLED', 'BUS_ARRIVED'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ message: 'Invalid transport event type' });
  }

  // BUS_ADMIN can only notify for their assigned bus (BUS_052 -> GRP003)
  if (req.user.role === 'BUS_ADMIN') {
    if (busId !== 'BUS_052') {
      return res.status(403).json({ 
        message: 'BUS_ADMIN can only fire events for assigned bus (BUS_052)',
        deniedBuses: ['BUS_018', 'BUS_007']
      });
    }
  }

  res.json({
    message: 'Transport event fired successfully',
    event: {
      type: eventType,
      domain: 'transport',
      busId: busId,
      groupId: 'GRP003', // 34 students subscribed to BUS_052
      reason: reason,
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    notification: 'Students subscribed to this bus will be notified'
  });
});

module.exports = router;

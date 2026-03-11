const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const laundryController = require('../controllers/laundryController');

/**
 * LAUNDRY ROUTES (LAUNDRY_ADMIN + SUPER_ADMIN)
 * Laundry Admins can manage their assigned block only (Block A - GRP004)
 * Manages 3 machines assigned to them
 */

// GET /laundry - List all laundry groups (LAUNDRY_ADMIN + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  // LAUNDRY_ADMIN sees only their block, SUPER_ADMIN sees all
  res.json({ 
    message: 'Get all laundry groups',
    role: req.user.role,
    accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all blocks' : 'assigned block only (Block A - GRP004)'
  });
});

// POST /laundry - Create laundry group (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can create laundry groups' });
  }
  res.json({ message: 'Create laundry group - SUPER_ADMIN only' });
});

// GET /laundry/:id - Get specific laundry group details (LAUNDRY_ADMIN + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  // If LAUNDRY_ADMIN, check they own this block
  const blockId = req.params.id;
  if (req.user.role === 'LAUNDRY_ADMIN' && blockId !== 'HOSTEL-A') {
    return res.status(403).json({ message: 'LAUNDRY_ADMIN can only access assigned block (Block A)' });
  }
  
  res.json({ 
    message: 'Get laundry group details',
    blockId: blockId,
    role: req.user.role
  });
});

// PUT /laundry/:id - Update laundry group (LAUNDRY_ADMIN assigned only)
router.put('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  const blockId = req.params.id;
  
  // Only SUPER_ADMIN or assigned LAUNDRY_ADMIN can update
  if (req.user.role === 'LAUNDRY_ADMIN' && blockId !== 'HOSTEL-A') {
    return res.status(403).json({ message: 'LAUNDRY_ADMIN can only update assigned block (Block A)' });
  }
  
  res.json({ 
    message: 'Update laundry group',
    blockId: blockId,
    role: req.user.role
  });
});

// DELETE /laundry/:id - Delete laundry group (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can delete laundry groups' });
  }
  res.json({ message: 'Delete laundry group - SUPER_ADMIN only' });
});

// POST /laundry/event - Fire laundry event (LAUNDRY_ADMIN + SUPER_ADMIN)
// Event types: WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, WASH_MACHINE_STARTED, WASH_SLOT_BOOKED
router.post('/event', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), (req, res) => {
  const { eventType, machine, blockId, reason } = req.body;
  
  // Validate event type
  const validTypes = ['WASH_MACHINE_COMPLETED', 'WASH_SLOT_CANCELLED', 'WASH_MACHINE_STARTED', 'WASH_SLOT_BOOKED'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ message: 'Invalid laundry event type' });
  }

  // LAUNDRY_ADMIN can only notify for their assigned block (Block A -> GRP004)
  if (req.user.role === 'LAUNDRY_ADMIN') {
    if (!blockId || blockId !== 'HOSTEL-A') {
      return res.status(403).json({ 
        message: 'LAUNDRY_ADMIN can only fire events for assigned block (Block A)',
        assignedBlock: 'HOSTEL-A (45 students)'
      });
    }
  }

  res.json({
    message: 'Laundry event fired successfully',
    event: {
      type: eventType,
      domain: 'laundry',
      blockId: blockId || 'HOSTEL-A',
      machine: machine,
      groupId: 'GRP004', // 45 students in Block A
      reason: reason,
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    notification: 'Students in Block A will be notified'
  });
});

module.exports = router;

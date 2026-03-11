const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const messController = require('../controllers/messController');

/**
 * MESS ROUTES (MESS_ADMIN + SUPER_ADMIN)
 * Mess Admins can manage their assigned mess only (Main Mess - GRP005)
 * Manages check-ins, absences, and refunds for all 247 students
 */

// GET /mess - List all mess groups (MESS_ADMIN + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  // MESS_ADMIN sees only their mess, SUPER_ADMIN sees all
  res.json({ 
    message: 'Get all mess groups',
    role: req.user.role,
    accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all messes' : 'assigned mess only (Main Mess - GRP005)'
  });
});

// POST /mess - Create mess group (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can create mess groups' });
  }
  res.json({ message: 'Create mess group - SUPER_ADMIN only' });
});

// GET /mess/:id - Get specific mess group details (MESS_ADMIN + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  // If MESS_ADMIN, check they own this mess
  const messId = req.params.id;
  if (req.user.role === 'MESS_ADMIN' && messId !== 'MAIN_MESS') {
    return res.status(403).json({ message: 'MESS_ADMIN can only access assigned mess (Main Mess)' });
  }
  
  res.json({ 
    message: 'Get mess group details',
    messId: messId,
    role: req.user.role
  });
});

// PUT /mess/:id - Update mess group (MESS_ADMIN assigned only)
router.put('/:id', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  const messId = req.params.id;
  
  // Only SUPER_ADMIN or assigned MESS_ADMIN can update
  if (req.user.role === 'MESS_ADMIN' && messId !== 'MAIN_MESS') {
    return res.status(403).json({ message: 'MESS_ADMIN can only update assigned mess (Main Mess)' });
  }
  
  res.json({ 
    message: 'Update mess group',
    messId: messId,
    role: req.user.role
  });
});

// DELETE /mess/:id - Delete mess group (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can delete mess groups' });
  }
  res.json({ message: 'Delete mess group - SUPER_ADMIN only' });
});

// POST /mess/event - Fire mess event (MESS_ADMIN + SUPER_ADMIN)
// Event types: MESS_CHECKIN, MESS_ABSENT, MESS_REFUND_REQUESTED, MESS_REFUND_PROCESSED
router.post('/event', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  const { eventType, studentId, mealType, refundAmount, reason } = req.body;
  
  // Validate event type
  const validTypes = ['MESS_CHECKIN', 'MESS_ABSENT', 'MESS_REFUND_REQUESTED', 'MESS_REFUND_PROCESSED'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ message: 'Invalid mess event type' });
  }

  // Validate meal type
  const validMeals = ['breakfast', 'lunch', 'dinner'];
  if (!validMeals.includes(mealType)) {
    return res.status(400).json({ message: 'Invalid meal type' });
  }

  res.json({
    message: 'Mess event fired successfully',
    event: {
      type: eventType,
      domain: 'mess',
      messId: 'MAIN_MESS',
      groupId: 'GRP005', // All 247 students in main mess
      studentId: studentId,
      mealType: mealType,
      refundAmount: refundAmount,
      reason: reason,
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    notification: eventType === 'MESS_CHECKIN' || eventType === 'MESS_ABSENT' 
      ? 'Student will be notified directly' 
      : 'Refund notification sent to student'
  });
});

// GET /mess/checkins/:date - Get check-ins for a specific date (MESS_ADMIN + SUPER_ADMIN)
router.get('/checkins/:date', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  res.json({
    message: 'Get check-ins for date',
    date: req.params.date,
    checkedIn: 183,
    absent: 64
  });
});

// POST /mess/refund - Process refund (MESS_ADMIN + SUPER_ADMIN)
router.post('/refund', verifyToken, allowRolesWithSuper('MESS_ADMIN'), (req, res) => {
  const { studentId, amount } = req.body;
  res.json({
    message: 'Refund processed',
    studentId: studentId,
    amount: amount,
    status: 'pending - will be credited in 3 working days'
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const academicController = require('../controllers/academicController');

/**
 * ACADEMIC ROUTES (TEACHER + SUPER_ADMIN)
 * Teachers can only access/read their assigned courses (GRP001, GRP002)
 * Teachers can fire academic events to their groups
 */

// GET /academics - List academic groups (TEACHER + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  // TEACHER sees only their courses, SUPER_ADMIN sees all
  // const groups = req.user.role === 'SUPER_ADMIN' ? allGroups : req.user.assignedGroups;
  res.json({ 
    message: 'Get academic groups',
    role: req.user.role,
    accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all groups' : 'assigned groups only'
  });
});

// POST /academics - Create academic group (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can create academic groups' });
  }
  res.json({ message: 'Create academic group - SUPER_ADMIN only' });
});

// GET /academics/:id - Get specific academic group details (TEACHER + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  // Verify teacher has access to this group if not SUPER_ADMIN
  res.json({ 
    message: 'Get academic group details',
    groupId: req.params.id,
    role: req.user.role
  });
});

// PUT /academics/:id - Update academic group (SUPER_ADMIN ONLY)
router.put('/:id', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can update academic groups' });
  }
  res.json({ message: 'Update academic group - SUPER_ADMIN only' });
});

// DELETE /academics/:id - Delete academic group (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only SUPER_ADMIN can delete academic groups' });
  }
  res.json({ message: 'Delete academic group - SUPER_ADMIN only' });
});

// POST /academics/event - Fire academic event (TEACHER + SUPER_ADMIN)
// Event types: CLASS_CANCELLED, CLASS_RESCHEDULED, EXAM_POSTPONED
router.post('/event', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  const { eventType, groupId, reason, newTime, newHall } = req.body;
  
  // Validate event type
  const validTypes = ['CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'EXAM_POSTPONED'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ message: 'Invalid academic event type' });
  }

  // TEACHER can only notify students in their assigned groups (GRP001, GRP002)
  if (req.user.role === 'TEACHER') {
    const allowedGroups = ['GRP001', 'GRP002'];
    if (!allowedGroups.includes(groupId)) {
      return res.status(403).json({ message: 'TEACHER can only fire events to assigned groups (GRP001, GRP002)' });
    }
  }

  res.json({
    message: 'Academic event fired successfully',
    event: {
      type: eventType,
      domain: 'academics',
      groupId: groupId,
      reason: reason,
      newTime: newTime,
      newHall: newHall,
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    notification: 'Students in group will be notified'
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper, allowRoles } = require('../middleware/authMiddleware');

/**
 * ACADEMIC ROUTES (TEACHER + SUPER_ADMIN)
 * Teachers can only access/read their assigned courses (GRP001, GRP002)
 * Teachers can fire academic events to their groups
 */

// GET /academics - List academic groups (TEACHER + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  res.json({ 
    message: 'Get academic groups',
    role: req.user.role,
    accessLevel: req.user.role === 'SUPER_ADMIN' ? 'all groups' : 'assigned groups only'
  });
});

router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  res.json({ message: 'Create academic group - SUPER_ADMIN only' });
});

// GET /academics/:id - Get specific academic group details (TEACHER + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  res.json({ 
    message: 'Get academic group details',
    groupId: req.params.id,
    role: req.user.role
  });
});

router.put('/:id', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  res.json({ message: 'Update academic group - SUPER_ADMIN only' });
});

router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  res.json({ message: 'Delete academic group - SUPER_ADMIN only' });
});

// POST /academics/event - Fire academic event (TEACHER + SUPER_ADMIN)
router.post('/event', verifyToken, allowRolesWithSuper('TEACHER'), (req, res) => {
  const { eventType, groupId, reason, newTime, newHall } = req.body;
  
  const validTypes = ['CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'EXAM_POSTPONED'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ message: 'Invalid academic event type' });
  }

  // TEACHER can only fire events to their assigned groups
  if (req.user.role === 'TEACHER' && !req.user.groups.includes(groupId)) {
    return res.status(403).json({ message: 'TEACHER can only fire events to assigned groups' });
  }

  res.json({
    message: 'Academic event fired successfully',
    event: {
      type: eventType,
      domain: 'academics',
      groupId,
      reason,
      newTime,
      newHall,
      firedBy: req.user.username,
      timestamp: new Date().toISOString()
    },
    notification: 'Students in group will be notified'
  });
});

module.exports = router;
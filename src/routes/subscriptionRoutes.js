const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');
// const subscriptionController = require('../controllers/subscriptionController');

/**
 * SUBSCRIPTION ROUTES (Student - Read own, Admin - Manage all)
 * Students can subscribe/unsubscribe from groups
 * Domain admins can view their group subscribers
 * SUPER_ADMIN can view all subscriptions
 */

// POST /subscriptions - Subscribe student to a group (STUDENT + Admins)
router.post('/', verifyToken, (req, res) => {
  const { studentId, groupId } = req.body;
  
  // STUDENT can only subscribe themselves
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only manage own subscriptions' });
  }

  // Admins (SUPER_ADMIN, TEACHER, etc) can subscribe students
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role) && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Subscribed to group',
    studentId: studentId,
    groupId: groupId,
    subscribedBy: req.user.role === 'STUDENT' ? 'self' : req.user.username,
    timestamp: new Date().toISOString()
  });
});

// DELETE /subscriptions/:id - Unsubscribe from a group (STUDENT + Admins)
router.delete('/:id', verifyToken, (req, res) => {
  const subscriptionId = req.params.id;
  
  // STUDENT can unsubscribe themselves
  // Admins can revoke subscriptions
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role) && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Unsubscribed from group',
    subscriptionId: subscriptionId,
    unsubscribedBy: req.user.username
  });
});

// GET /subscriptions/student/:studentId - Get student's subscriptions
router.get('/student/:studentId', verifyToken, (req, res) => {
  const studentId = req.params.studentId;
  
  // STUDENT can only view own subscriptions
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only view own subscriptions' });
  }

  // Admins can view any student's subscriptions
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role) && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Get student subscriptions',
    studentId: studentId,
    subscriptions: [
      { groupId: 'GRP001', groupName: 'CS101 — Data Structures', type: 'academics' },
      { groupId: 'GRP002', groupName: 'CS202 — Operating Systems', type: 'academics' },
      { groupId: 'GRP003', groupName: 'Bus 052', type: 'transport' },
      { groupId: 'GRP004', groupName: 'Block A Laundry', type: 'laundry' },
      { groupId: 'GRP005', groupName: 'Main Mess', type: 'mess' }
    ],
    total: 5
  });
});

// GET /subscriptions/group/:groupId - Get group's subscribers (Admin only)
router.get('/group/:groupId', verifyToken, (req, res) => {
  const groupId = req.params.groupId;
  
  // Only SUPER_ADMIN and relevant domain admins can view subscribers
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admins can view group subscribers' });
  }

  // Domain admins can only view their group subscribers
  const groupAdminMap = {
    'GRP001': ['TEACHER', 'SUPER_ADMIN'],
    'GRP002': ['TEACHER', 'SUPER_ADMIN'],
    'GRP003': ['BUS_ADMIN', 'SUPER_ADMIN'],
    'GRP004': ['LAUNDRY_ADMIN', 'SUPER_ADMIN'],
    'GRP005': ['MESS_ADMIN', 'SUPER_ADMIN']
  };

  if (!groupAdminMap[groupId]?.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this group\'s subscribers' });
  }

  res.json({ 
    message: `Get ${groupId} subscribers`,
    groupId: groupId,
    subscriberCount: 50,
    subscribers: [
      { studentId: 'STU001', name: 'John Doe', email: 'john@campus.edu' },
      { studentId: 'STU002', name: 'Alice Kumar', email: 'alice@campus.edu' }
    ]
  });
});

module.exports = router;

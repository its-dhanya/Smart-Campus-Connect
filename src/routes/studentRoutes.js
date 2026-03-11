const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
// const studentController = require('../controllers/studentController');

/**
 * STUDENT ROUTES (Protected by role)
 * STUDENT: Can only view/edit own profile
 * Admins (SUPER_ADMIN): Can view/edit any student
 */

// GET /students/:id - Get student profile
router.get('/:id', verifyToken, (req, res) => {
  const studentId = req.params.id;
  
  // STUDENT can only view own profile
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only view own profile' });
  }

  // Admins can view any student
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role) && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Get student profile',
    student: {
      id: studentId,
      name: 'John Doe',
      email: 'john@campus.edu',
      rollNo: 'CS2021045',
      department: 'Computer Science',
      semester: 4,
      hostelBlock: 'A',
      createdAt: '2021-08-15'
    }
  });
});

// PUT /students/:id - Update student profile
router.put('/:id', verifyToken, (req, res) => {
  const studentId = req.params.id;
  
  // STUDENT can only update own profile
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only update own profile' });
  }

  // SUPER_ADMIN can update any student
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Student profile updated',
    studentId: studentId,
    updatedBy: req.user.username
  });
});

// PUT /students/:id/fcm-token - Update FCM token for push notifications
router.put('/:id/fcm-token', verifyToken, (req, res) => {
  const studentId = req.params.id;
  const { fcmToken } = req.body;
  
  // STUDENT can only update own FCM token
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only update own FCM token' });
  }

  if (!fcmToken) {
    return res.status(400).json({ message: 'FCM token is required' });
  }

  res.json({ 
    message: 'FCM token updated successfully',
    studentId: studentId,
    tokenUpdated: true
  });
});

// GET /students/:id/groups - Get groups student belongs to
router.get('/:id/groups', verifyToken, (req, res) => {
  const studentId = req.params.id;
  
  // STUDENT can only view own groups
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only view own groups' });
  }

  // Admins can view any student's groups
  const adminRoles = ['SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'];
  if (!adminRoles.includes(req.user.role) && req.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ 
    message: 'Get student groups',
    studentId: studentId,
    groups: [
      { groupId: 'GRP001', groupName: 'CS101 — Data Structures', type: 'academics', members: 62 },
      { groupId: 'GRP002', groupName: 'CS202 — Operating Systems', type: 'academics', members: 55 },
      { groupId: 'GRP003', groupName: 'Bus 052 — Route 42', type: 'transport', members: 34 },
      { groupId: 'GRP004', groupName: 'Block A Laundry', type: 'laundry', members: 45 },
      { groupId: 'GRP005', groupName: 'Main Mess', type: 'mess', members: 247 }
    ],
    total: 5
  });
});

// GET /students/:id/notifications - Get student notifications (STUDENT READ-ONLY)
router.get('/:id/notifications', verifyToken, (req, res) => {
  const studentId = req.params.id;
  
  // STUDENT can only view own notifications
  if (req.user.role === 'STUDENT' && studentId !== req.user.id) {
    return res.status(403).json({ message: 'STUDENT can only view own notifications' });
  }

  res.json({ 
    message: 'Get student notifications',
    studentId: studentId,
    notifications: [
      { id: 1, type: 'BUS_DELAYED', title: 'Bus Delayed', message: 'BUS_052 running 10 mins late', time: '2 mins ago', read: false },
      { id: 2, type: 'CLASS_CANCELLED', title: 'Class Cancelled', message: 'CS101 at 2PM cancelled today', time: '1 hr ago', read: false },
      { id: 3, type: 'WASH_DONE', title: 'Wash Done', message: 'Collect from Block A Machine 2', time: '3 hrs ago', read: true },
      { id: 4, type: 'MESS_CHECKIN', title: 'Mess Check-in', message: 'Lunch at 12:45 PM recorded', time: '12:45 PM', read: true }
    ],
    totalUnread: 2
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');
const subscriptionController = require('../controllers/subscriptionController');

// POST /subscriptions - Subscribe student to a group
router.post('/', verifyToken, subscriptionController.subscribe);

// DELETE /subscriptions/:id - Unsubscribe
router.delete('/:id', verifyToken, subscriptionController.unsubscribe);

// GET /subscriptions/student/:studentId - Get a student's subscriptions
router.get('/student/:studentId', verifyToken, subscriptionController.getStudentSubscriptions);

// GET /subscriptions/group/:groupId - Get a group's subscribers (admins only)
router.get(
  '/group/:groupId',
  verifyToken,
  allowRoles('SUPER_ADMIN', 'TEACHER', 'BUS_ADMIN', 'LAUNDRY_ADMIN', 'MESS_ADMIN'),
  subscriptionController.getGroupSubscribers
);

module.exports = router;
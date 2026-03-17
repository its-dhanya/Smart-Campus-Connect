const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

// GET /students/:id - Get student profile
router.get('/:id', verifyToken, studentController.getStudentById);

// PUT /students/:id - Update student profile
router.put('/:id', verifyToken, studentController.updateStudent);

// PUT /students/:id/fcm-token - Update FCM push token
router.put('/:id/fcm-token', verifyToken, studentController.updateFcmToken);

// GET /students/:id/groups - Get groups the student belongs to
router.get('/:id/groups', verifyToken, studentController.getStudentGroups);

// GET /students/:id/notifications - Get student notifications (last 24 h, non-dismissed)
router.get('/:id/notifications', verifyToken, studentController.getStudentNotifications);

// DELETE /students/:id/notifications/:eventId - Dismiss a notification
router.delete('/:id/notifications/:eventId', verifyToken, studentController.deleteStudentNotification);

module.exports = router;
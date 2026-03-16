const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

// User Management Routes - SUPER_ADMIN only
router.post('/users', verifyToken, allowRoles('SUPER_ADMIN'), adminController.createUser);
router.get('/users', verifyToken, allowRoles('SUPER_ADMIN'), adminController.getAllUsers);
router.get('/users/:id', verifyToken, allowRoles('SUPER_ADMIN'), adminController.getUserById);
router.put('/users/:id', verifyToken, allowRoles('SUPER_ADMIN'), adminController.updateUser);
router.delete('/users/:id', verifyToken, allowRoles('SUPER_ADMIN'), adminController.deleteUser);

// GET /admin/stats - System statistics
router.get('/stats', verifyToken, allowRoles('SUPER_ADMIN'), adminController.getStats);

// GET /admin/queue-status - Check Bull MQ queue status
router.get('/queue-status', verifyToken, allowRoles('SUPER_ADMIN'), adminController.getQueueStatus);

// POST /admin/resend-notifications/:eventId - Resend notifications for an event
router.post('/resend-notifications/:eventId', verifyToken, allowRoles('SUPER_ADMIN'), adminController.resendNotifications);

module.exports = router;

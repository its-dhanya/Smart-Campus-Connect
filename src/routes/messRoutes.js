const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles, allowRolesWithSuper } = require('../middleware/authMiddleware');
const messController = require('../controllers/messController');

// GET /mess - List all mess groups
router.get('/', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.getAllMessGroups);

// POST /mess - Create mess group (SUPER_ADMIN only)
router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), messController.createMessGroup);

// GET /mess/checkins/:date - Get check-ins for a date (before /:id to avoid param clash)
router.get('/checkins/:date', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.getCheckins);

// POST /mess/refund - Process refund
router.post('/refund', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.processRefund);

// POST /mess/event - Fire mess event
router.post('/event', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.fireMessEvent);

// GET /mess/events/:messId - Get recent mess events
router.get('/events/:messId', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.getRecentMessEvents);

// GET /mess/summary/:month - Get monthly summary
router.get('/summary/:month', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.getMessSummary);

// GET /mess/:id - Get specific mess group details
router.get('/:id', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.getMessGroupById);

// PUT /mess/:id - Update mess group
router.put('/:id', verifyToken, allowRolesWithSuper('MESS_ADMIN'), messController.updateMessGroup);

// DELETE /mess/:id - Delete mess group (SUPER_ADMIN only)
router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), messController.deleteMessGroup);

module.exports = router;
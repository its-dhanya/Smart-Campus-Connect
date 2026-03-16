const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles, allowRolesWithSuper } = require('../middleware/authMiddleware');
const transportController = require('../controllers/transportController');

// GET /bus - List all buses
router.get('/', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.getAllBuses);

// POST /bus - Create bus (SUPER_ADMIN only)
router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), transportController.createBus);

// POST /bus/event - Fire transport event (before /:id to avoid param clash)
router.post('/event', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.fireTransportEvent);

// GET /bus/status/:busId - Get bus status
router.get('/status/:busId', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.getBusStatus);

// GET /bus/events/:busId - Get recent transport events
router.get('/events/:busId', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.getRecentTransportEvents);

// GET /bus/:id - Get specific bus details
router.get('/:id', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.getBusById);

// PUT /bus/:id - Update bus
router.put('/:id', verifyToken, allowRolesWithSuper('BUS_ADMIN'), transportController.updateBus);

// DELETE /bus/:id - Delete bus (SUPER_ADMIN only)
router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), transportController.deleteBus);

module.exports = router;
const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper } = require('../middleware/authMiddleware');
const laundryController = require('../controllers/laundryController');

/**
 * LAUNDRY ROUTES (LAUNDRY_ADMIN + SUPER_ADMIN)
 * Laundry Admins can manage their assigned block only (Block A - GRP004)
 * Manages 3 machines assigned to them
 */

// GET /laundry - List all laundry groups
router.get('/', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.getAllLaundryGroups);

// POST /laundry - Create laundry group (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.createLaundryGroup);

// GET /laundry/:id - Get specific laundry group details
router.get('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.getLaundryGroupById);

// PUT /laundry/:id - Update laundry group
router.put('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.updateLaundryGroup);

// DELETE /laundry/:id - Delete laundry group (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.deleteLaundryGroup);

// POST /laundry/event - Fire laundry event
// Event types: WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, WASH_MACHINE_STARTED, WASH_SLOT_BOOKED
router.post('/event', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.fireLaundryEvent);

// GET /laundry/machines/:blockId - Get machine status for a block
router.get('/machines/:blockId', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.getMachineStatus);

// GET /laundry/events/:blockId - Get recent laundry events for a block
router.get('/events/:blockId', verifyToken, allowRolesWithSuper('LAUNDRY_ADMIN'), laundryController.getRecentLaundryEvents);

module.exports = router;

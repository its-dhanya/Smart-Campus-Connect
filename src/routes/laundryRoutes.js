const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const laundryController = require('../controllers/laundryController');

/**
 * LAUNDRY ROUTES
 *
 * Students:
 *   GET    /laundry/slots/available          — ?block=HOSTEL-A&date=YYYY-MM-DD
 *   POST   /laundry/slots/book               — body: { block, machine, time }
 *                                              date is always tomorrow (server-enforced)
 *   GET    /laundry/my-bookings
 *   DELETE /laundry/slots/cancel             — ?block&date&machine&time
 *
 * Admins:
 *   GET    /laundry/dashboard/:block         — ?date=YYYY-MM-DD
 */

// ── Student ───────────────────────────────────────────────────────────────────
router.get('/slots/available', verifyToken, laundryController.getAvailableSlots);
router.post('/slots/book',     verifyToken, laundryController.bookLaundrySlot);
router.get('/my-bookings',     verifyToken, laundryController.getMyBookings);
router.delete('/slots/cancel', verifyToken, laundryController.cancelSlot);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/dashboard/:block', verifyToken, laundryController.getLaundryDashboard);

module.exports = router;
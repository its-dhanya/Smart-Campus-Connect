const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const messController = require('../controllers/messController');

/**
 * MESS ROUTES
 *
 * Students:
 *   POST   /mess/checkin               — check in for a meal (today only, no date param)
 *   GET    /mess/meals/:date            — view meals for :date (students: today only)
 *   GET    /mess/monthly-summary        — ?month=YYYY-MM
 *   POST   /mess/request-refund         — body: { month }
 *
 * Admins:
 *   GET    /mess/admin/daily-checkins   — ?date=YYYY-MM-DD
 *   GET    /mess/admin/monthly-report   — ?month=YYYY-MM
 */

// ── Student ──────────────────────────────────────────────────────────────────

// Check in for a meal (date is always today, enforced server-side)
router.post('/checkin', verifyToken, messController.checkInMeal);

// View meals for a date (students restricted to today)
router.get('/meals/:date', verifyToken, messController.getMyMealsForDate);

// Monthly summary with refund calculation
router.get('/monthly-summary', verifyToken, messController.getMonthlySummary);

// Request refund for the month
router.post('/request-refund', verifyToken, messController.requestMonthlyRefund);

// ── Admin ─────────────────────────────────────────────────────────────────────

router.get('/admin/daily-checkins', verifyToken, messController.getDailyCheckins);
router.get('/admin/monthly-report', verifyToken, messController.getMonthlyRefundReport);

module.exports = router;
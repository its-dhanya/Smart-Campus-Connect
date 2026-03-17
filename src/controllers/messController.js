const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const Event = require('../models/Event');
const eventQueue = require('../queue/eventQueue');

/**
 * MESS CONTROLLER
 * Simple meal tracking and auto-refund system.
 * ₹80 per meal; auto-refund for missed meals at month end.
 *
 * RULE: students can only check in for TODAY's date.
 */

const COST_PER_MEAL = 80;
const MEALS = ['breakfast', 'lunch', 'dinner'];

// In-memory store: { '<studentId>-YYYY-MM-DD': { breakfast, lunch, dinner } }
const mealCheckins = {};

/** Return today's date string in IST (or server local time) as YYYY-MM-DD */
function todayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse a checkin key back into { studentId, date }.
 * Key format: "<ObjectId>-YYYY-MM-DD"   (ObjectId has no hyphens)
 */
function parseCheckinKey(key) {
  const parts = key.split('-');
  const date = parts.slice(-3).join('-');       // last 3 → YYYY-MM-DD
  const studentId = parts.slice(0, -3).join('-');
  return { studentId, date };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mess/checkin
 * Body: { mealType: 'breakfast|lunch|dinner' }
 *
 * The date is always today — students cannot check in for past or future dates.
 */
exports.checkInMeal = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { mealType } = req.body;

    if (!MEALS.includes(mealType)) {
      return res.status(400).json({
        message: 'Invalid meal type',
        validMeals: MEALS,
      });
    }

    // Always use server's today — ignore any client-supplied date
    const date = todayString();
    const key = `${studentId}-${date}`;

    if (!mealCheckins[key]) {
      mealCheckins[key] = { breakfast: false, lunch: false, dinner: false };
    }

    if (mealCheckins[key][mealType]) {
      return res.status(409).json({
        message: `Already checked in for ${mealType} today`,
        date,
      });
    }

    mealCheckins[key][mealType] = true;

    const student = await Student.findById(studentId);
    const mess = await Group.findOne({ ownerId: 'MAIN_MESS', type: 'MESS' });

    const event = new Event({
      domain: 'mess',
      type: 'MESS_CHECKIN',
      groupId: mess._id,
      entityId: 'MAIN_MESS',
      metadata: {
        studentId,
        studentName: student.name,
        mealType,
        date,
      },
      firedBy: 'STUDENT',
      status: 'completed',
    });
    await event.save();

    return res.status(201).json({
      message: `Checked in for ${mealType}`,
      checkin: {
        studentId,
        date,
        mealType,
        cost: COST_PER_MEAL,
        checkedInAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error checking in:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/meals/:date
 * Students can only query today's date.
 */
exports.getMyMealsForDate = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { date } = req.params;
    const today = todayString();

    // Students are restricted to today's data
    if (req.user.role === 'STUDENT' && date !== today) {
      return res.status(403).json({
        message: 'Students can only view meal data for today',
        today,
      });
    }

    const key = `${studentId}-${date}`;
    const meals = mealCheckins[key] || { breakfast: false, lunch: false, dinner: false };

    const mealsData = MEALS.map((meal) => ({
      mealType: meal,
      checkedIn: meals[meal],
      cost: COST_PER_MEAL,
      status: meals[meal] ? 'attended' : 'missed',
    }));

    const attended = mealsData.filter((m) => m.checkedIn).length;
    const missed = 3 - attended;

    return res.json({
      message: 'Meals retrieved',
      date,
      meals: mealsData,
      summary: {
        attended,
        missed,
        costIncurred: attended * COST_PER_MEAL,
        refundDue: missed * COST_PER_MEAL,
      },
    });
  } catch (error) {
    console.error('Error getting meals:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/monthly-summary
 * Query: ?month=2026-03  (defaults to current month)
 */
exports.getMonthlySummary = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { month } = req.query;

    let targetMonth = month;
    if (!targetMonth) {
      const now = new Date();
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, monthNum] = targetMonth.split('-');
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    let totalAttended = 0;
    let totalMissed = 0;
    const dayWiseMeals = {};

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const key = `${studentId}-${dateStr}`;
      const meals = mealCheckins[key] || { breakfast: false, lunch: false, dinner: false };

      const attended = Object.values(meals).filter((v) => v).length;
      const missed = 3 - attended;

      totalAttended += attended;
      totalMissed += missed;
      dayWiseMeals[dateStr] = { attended, missed, meals };
    }

    const daysInMonth = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const totalMealsExpected = daysInMonth * 3;

    return res.json({
      message: 'Monthly summary retrieved',
      month: targetMonth,
      summary: {
        daysInMonth,
        totalMealsExpected,
        mealsAttended: totalAttended,
        mealsMissed: totalMissed,
        costIncurred: totalAttended * COST_PER_MEAL,
        refundDue: totalMissed * COST_PER_MEAL,
        attendancePercentage:
          ((totalAttended / totalMealsExpected) * 100).toFixed(2) + '%',
      },
      dayWiseSummary: dayWiseMeals,
    });
  } catch (error) {
    console.error('Error getting summary:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /mess/request-refund
 * Body: { month: 'YYYY-MM' }
 */
exports.requestMonthlyRefund = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { month } = req.body;

    if (!month) {
      return res.status(400).json({ message: 'Month required (YYYY-MM)' });
    }

    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    let totalMissed = 0;
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const key = `${studentId}-${dateStr}`;
      const meals = mealCheckins[key] || { breakfast: false, lunch: false, dinner: false };
      totalMissed += 3 - Object.values(meals).filter((v) => v).length;
    }

    const refundAmount = totalMissed * COST_PER_MEAL;

    const student = await Student.findById(studentId);
    const mess = await Group.findOne({ ownerId: 'MAIN_MESS', type: 'MESS' });

    const event = new Event({
      domain: 'mess',
      type: 'MESS_REFUND_REQUESTED',
      groupId: mess._id,
      entityId: 'MAIN_MESS',
      metadata: {
        studentId,
        studentName: student.name,
        month,
        refundAmount,
        mealsMissed: totalMissed,
      },
      firedBy: 'STUDENT',
      status: 'pending',
      deliveryStats: { total: 1, delivered: 0, failed: 0, pending: 1 },
    });
    await event.save();

    if (eventQueue) {
      await eventQueue.add('mess-event', {
        eventId: event._id,
        type: 'MESS_REFUND_REQUESTED',
        studentId,
        studentName: student.name,
        month,
        refundAmount,
        timestamp: new Date(),
      });
    }

    return res.status(201).json({
      message: 'Refund request submitted',
      refundRequest: {
        studentId,
        month,
        mealsMissed: totalMissed,
        refundAmount,
        status: 'pending',
        requestedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error requesting refund:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /mess/admin/daily-checkins?date=YYYY-MM-DD
 */
exports.getDailyCheckins = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date required (YYYY-MM-DD)' });
    }

    const breakfastCount = Object.keys(mealCheckins).filter(
      (k) => k.endsWith(`-${date}`) && mealCheckins[k].breakfast
    ).length;
    const lunchCount = Object.keys(mealCheckins).filter(
      (k) => k.endsWith(`-${date}`) && mealCheckins[k].lunch
    ).length;
    const dinnerCount = Object.keys(mealCheckins).filter(
      (k) => k.endsWith(`-${date}`) && mealCheckins[k].dinner
    ).length;

    return res.json({
      message: 'Daily check-ins retrieved',
      date,
      checkins: {
        breakfast: breakfastCount,
        lunch: lunchCount,
        dinner: dinnerCount,
        total: breakfastCount + lunchCount + dinnerCount,
      },
    });
  } catch (error) {
    console.error('Error getting checkins:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /mess/admin/monthly-report?month=YYYY-MM
 */
exports.getMonthlyRefundReport = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: 'Month required (YYYY-MM)' });
    }

    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const refunds = {};
    let totalRefundDue = 0;

    for (const checkinKey in mealCheckins) {
      const { studentId, date } = parseCheckinKey(checkinKey);
      const d = new Date(date);

      if (d >= startDate && d < endDate) {
        if (!refunds[studentId]) {
          refunds[studentId] = { missed: 0, refund: 0 };
        }
        const meals = mealCheckins[checkinKey];
        refunds[studentId].missed += 3 - Object.values(meals).filter((v) => v).length;
      }
    }

    for (const studentId in refunds) {
      refunds[studentId].refund = refunds[studentId].missed * COST_PER_MEAL;
      totalRefundDue += refunds[studentId].refund;
    }

    return res.json({
      message: 'Monthly refund report',
      month,
      summary: {
        totalStudents: Object.keys(refunds).length,
        totalRefundDue,
        averageRefundPerStudent:
          Object.keys(refunds).length > 0
            ? (totalRefundDue / Object.keys(refunds).length).toFixed(2)
            : 0,
      },
      refundsByStudent: refunds,
    });
  } catch (error) {
    console.error('Error getting refund report:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
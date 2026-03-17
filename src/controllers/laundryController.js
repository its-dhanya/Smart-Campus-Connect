const Group = require('../models/Group');
const Subscription = require('../models/Subscription');
const Student = require('../models/Student');
const Event = require('../models/Event');
const eventQueue = require('../queue/eventQueue');

/**
 * LAUNDRY CONTROLLER
 *
 * Rules enforced:
 *  1. Bookings can only be made for TOMORROW — not today, not further ahead.
 *  2. A booked slot is automatically freed (set back to 'available') if the
 *     machine has not been marked 'in-use' within 1 hour of the slot start time.
 *     A lightweight per-request sweep handles this without a cron daemon.
 */

const MACHINES_PER_BLOCK = 5;
const SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00',
];

// In-memory store: { 'BLOCK-YYYY-MM-DD': { M1: { '06:00': {...}, ... }, ... } }
const slots = {};

/** YYYY-MM-DD string for today in server local time */
function todayString() {
  return new Date().toISOString().split('T')[0];
}

/** YYYY-MM-DD string for tomorrow */
function tomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Initialise all slots for a given block+date key if not already done */
function initSlots(slotKey) {
  if (slots[slotKey]) return;
  slots[slotKey] = {};
  for (let m = 1; m <= MACHINES_PER_BLOCK; m++) {
    slots[slotKey][`M${m}`] = {};
    for (const time of SLOTS) {
      slots[slotKey][`M${m}`][time] = {
        status: 'available',
        studentId: null,
        bookedAt: null,
      };
    }
  }
}

/**
 * AUTO-TRANSITION SWEEP
 *
 * Called at the top of every slot-read so no cron daemon is needed.
 *
 *  booked  → in-use    : at slot start time (the wash has begun)
 *  in-use  → available : 1 hour after slot start time (wash is done, free the machine)
 *  booked  → available : if slot start + 1h has passed and it was never picked up
 *                        (student no-show — same end result as the old logic)
 */
function sweepExpiredBookings(slotKey, date) {
  if (!slots[slotKey]) return;

  const now = new Date();

  for (const machine of Object.keys(slots[slotKey])) {
    for (const time of SLOTS) {
      const slot = slots[slotKey][machine][time];
      if (slot.status === 'available' || slot.status === 'completed') continue;

      const [hh, mm] = time.split(':').map(Number);
      const slotStart    = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
      const slotEnd      = new Date(slotStart.getTime() + 60 * 60 * 1000); // start + 1 h

      if (slot.status === 'booked') {
        if (now >= slotEnd) {
          // Start time + 1h passed and still just booked — student no-show, free the slot
          slots[slotKey][machine][time] = { status: 'available', studentId: null, bookedAt: null };
          console.log(`[Laundry] No-show auto-release: ${slotKey} ${machine} ${time}`);
        } else if (now >= slotStart) {
          // Slot start time reached — automatically mark in-use
          slots[slotKey][machine][time].status    = 'in-use';
          slots[slotKey][machine][time].startedAt = slotStart;
          console.log(`[Laundry] Auto in-use: ${slotKey} ${machine} ${time}`);
        }
      } else if (slot.status === 'in-use') {
        const startedAt = slot.startedAt ? new Date(slot.startedAt) : slotStart;
        if (now >= new Date(startedAt.getTime() + 60 * 60 * 1000)) {
          // 1 hour since start — wash done, free the machine
          slots[slotKey][machine][time] = { status: 'available', studentId: null, bookedAt: null };
          console.log(`[Laundry] Auto-completed and freed: ${slotKey} ${machine} ${time}`);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /laundry/slots/available?block=HOSTEL-A&date=YYYY-MM-DD
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { block = 'HOSTEL-A', date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date parameter required (YYYY-MM-DD)' });
    }

    const slotKey = `${block}-${date}`;
    initSlots(slotKey);
    sweepExpiredBookings(slotKey, date);

    const machineSlots = slots[slotKey];
    let availableCount = 0;
    let bookedCount = 0;

    for (const machine of Object.keys(machineSlots)) {
      for (const time of SLOTS) {
        machineSlots[machine][time].status === 'available'
          ? availableCount++
          : bookedCount++;
      }
    }

    return res.json({
      message: 'Available slots retrieved',
      block,
      date,
      totalMachines: MACHINES_PER_BLOCK,
      totalSlots: MACHINES_PER_BLOCK * SLOTS.length,
      availableSlots: availableCount,
      bookedSlots: bookedCount,
      slots: machineSlots,
    });
  } catch (error) {
    console.error('Error getting slots:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * POST /laundry/slots/book
 * Body: { block, machine, time }
 *
 * RULE: bookings are only allowed for TOMORROW's date.
 * The client does NOT send a date — the server derives it.
 */
exports.bookLaundrySlot = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { block = 'HOSTEL-A', machine, time } = req.body;

    if (!machine || !time) {
      return res.status(400).json({
        message: 'Required fields: machine (M1–M5), time (06:00–22:00)',
      });
    }

    // Enforce: only tomorrow is bookable
    const date = tomorrowString();
    const slotKey = `${block}-${date}`;

    initSlots(slotKey);
    sweepExpiredBookings(slotKey, date);

    if (!slots[slotKey][machine] || !slots[slotKey][machine][time]) {
      return res.status(400).json({ message: 'Invalid machine or time slot' });
    }

    if (slots[slotKey][machine][time].status !== 'available') {
      return res.status(409).json({
        message: 'Slot already booked',
        currentStatus: slots[slotKey][machine][time].status,
      });
    }

    // Check the student hasn't already booked a slot for tomorrow
    for (const m of Object.keys(slots[slotKey])) {
      for (const t of SLOTS) {
        if (
          slots[slotKey][m][t].studentId === studentId &&
          slots[slotKey][m][t].status === 'booked'
        ) {
          return res.status(409).json({
            message: 'You already have a booking for tomorrow',
            existing: { machine: m, time: t, date },
          });
        }
      }
    }

    const student = await Student.findById(studentId);

    slots[slotKey][machine][time] = {
      status: 'booked',
      studentId,
      studentName: student.name,
      bookedAt: new Date(),
    };

    // Fire event
    const group = await Group.findOne({ ownerId: block, type: 'LAUNDRY' });
    if (group) {
      const event = new Event({
        domain: 'laundry',
        type: 'WASH_SLOT_BOOKED',
        groupId: group._id,
        entityId: block,
        metadata: { machine, block, date, time, studentId },
        firedBy: 'STUDENT',
        status: 'completed',
      });
      await event.save();
    }

    return res.status(201).json({
      message: 'Slot booked successfully',
      booking: {
        block,
        machine,
        date,
        time,
        studentName: student.name,
        bookedAt: new Date(),
        status: 'booked',
        note: 'Slot will be auto-released if not started within 1 hour of slot time',
      },
    });
  } catch (error) {
    console.error('Error booking slot:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * GET /laundry/my-bookings
 */
exports.getMyBookings = async (req, res) => {
  try {
    const studentId = req.user.id;
    const bookings = [];

    for (const slotKey of Object.keys(slots)) {
      const parts = slotKey.split('-');
      // slotKey format: HOSTEL-A-YYYY-MM-DD  → last 3 parts are the date
      const date = parts.slice(-3).join('-');
      const block = parts.slice(0, -3).join('-');

      sweepExpiredBookings(slotKey, date);

      for (const machine of Object.keys(slots[slotKey])) {
        for (const time of SLOTS) {
          const slot = slots[slotKey][machine][time];
          if (slot.studentId === studentId) {
            bookings.push({ block, date, machine, time, status: slot.status, bookedAt: slot.bookedAt });
          }
        }
      }
    }

    return res.json({
      message: 'Bookings retrieved',
      totalBookings: bookings.length,
      bookings: bookings.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (error) {
    console.error('Error getting bookings:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * DELETE /laundry/slots/cancel?block=HOSTEL-A&date=YYYY-MM-DD&machine=M1&time=09:00
 */
exports.cancelSlot = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { block, date, machine, time } = req.query;

    const slotKey = `${block}-${date}`;

    if (!slots[slotKey] || !slots[slotKey][machine] || !slots[slotKey][machine][time]) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    const slot = slots[slotKey][machine][time];

    if (slot.studentId !== studentId) {
      return res.status(403).json({ message: 'Cannot cancel a slot booked by another student' });
    }

    if (slot.status === 'in-use' || slot.status === 'completed') {
      return res.status(409).json({ message: `Cannot cancel a ${slot.status} slot` });
    }

    slots[slotKey][machine][time] = { status: 'available', studentId: null, bookedAt: null };

    return res.json({
      message: 'Slot cancelled successfully',
      cancelled: { block, date, machine, time },
    });
  } catch (error) {
    console.error('Error cancelling slot:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /laundry/dashboard/:block?date=YYYY-MM-DD
 */
exports.getLaundryDashboard = async (req, res) => {
  try {
    const { block } = req.params;
    const { date = todayString() } = req.query;

    if (req.user.role === 'LAUNDRY_ADMIN' && block !== 'HOSTEL-A') {
      return res.status(403).json({ message: 'LAUNDRY_ADMIN can only access HOSTEL-A' });
    }

    const slotKey = `${block}-${date}`;
    initSlots(slotKey);
    sweepExpiredBookings(slotKey, date);

    const machineSlots = slots[slotKey];
    let available = 0, booked = 0, inUse = 0, completed = 0;

    for (const m of Object.keys(machineSlots)) {
      for (const t of SLOTS) {
        const status = machineSlots[m][t].status;
        if (status === 'available') available++;
        else if (status === 'booked') booked++;
        else if (status === 'in-use') inUse++;
        else if (status === 'completed') completed++;
      }
    }

    return res.json({
      message: 'Dashboard data',
      block,
      date,
      stats: { available, booked, inUse, completed },
      machines: machineSlots,
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('./src/models/Student');
const Event = require('./src/models/Event');
const { getMessaging } = require('./src/config/firebaseAdmin');

mongoose.connect(process.env.CONNECTION_STRING || 'mongodb://localhost:27017/SmartCampus');

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

connection.on('connect', () => console.log('✅ Redis connected'));
connection.on('error', (err) => console.error('❌ Redis error:', err.message));

const QUEUE_NAME = 'campus-events';
const eventQueue = new Queue(QUEUE_NAME, { connection });

// ─────────────────────────────────────────
// SHARED FCM SENDER
// ─────────────────────────────────────────

async function sendFCM({ tokens, title, body, data = {} }) {
  if (!tokens?.length) return { successCount: 0, failureCount: 0 };

  const messaging = getMessaging();
  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
  }

  return { successCount, failureCount };
}

// ─────────────────────────────────────────
// DOMAIN — TRANSPORT
// ─────────────────────────────────────────

async function handleTransport(job) {
  const { eventId, fcmTokens, type, busId, reason } = job.data;

  const messages = {
    BUS_ARRIVED:   { title: 'Bus Arrived 🚌',    body: 'Your bus has arrived at the stop.' },
    BUS_DELAYED:   { title: 'Bus Delayed ⏱️',    body: `Your bus is running late. ${reason || ''}`.trim() },
    BUS_CANCELLED: { title: 'Bus Cancelled 🚌',  body: `Bus ${busId} has been cancelled today. ${reason || ''}`.trim() },
  };

  const { title, body } = messages[type] || {};
  if (!title) { console.warn(`⚠️  Unknown transport type: ${type}`); return; }

  console.log(`📲 [transport] ${title} → ${fcmTokens?.length || 0} token(s)`);
  const { successCount, failureCount } = await sendFCM({ tokens: fcmTokens, title, body, data: { type, busId: busId || '', reason: reason || '' } });

  await updateEventStatus(eventId, successCount, failureCount);
}

// ─────────────────────────────────────────
// DOMAIN — ACADEMICS
// ─────────────────────────────────────────

async function handleAcademics(job) {
  const { eventId, fcmTokens, type, newTime, newHall, reason } = job.data;

  const messages = {
    CLASS_CANCELLED:   { title: 'Class Cancelled 📚',    body: `Class has been cancelled. ${reason || ''}`.trim() },
    CLASS_RESCHEDULED: { title: 'Class Rescheduled 🗓️', body: `Class moved to ${newTime || 'a new time'}${newHall ? ', ' + newHall : ''}. ${reason || ''}`.trim() },
    EXAM_POSTPONED:    { title: 'Exam Postponed 📝',     body: `Exam has been postponed. ${reason || ''}`.trim() },
  };

  const { title, body } = messages[type] || {};
  if (!title) { console.warn(`⚠️  Unknown academic type: ${type}`); return; }

  console.log(`📲 [academics] ${title} → ${fcmTokens?.length || 0} token(s)`);
  const { successCount, failureCount } = await sendFCM({ tokens: fcmTokens, title, body, data: { type, newTime: newTime || '', reason: reason || '' } });

  await updateEventStatus(eventId, successCount, failureCount);
}

// ─────────────────────────────────────────
// DOMAIN — LAUNDRY
// ─────────────────────────────────────────

async function handleLaundry(job) {
  const { eventId, fcmTokens, type, machine, blockId, reason } = job.data;

  const messages = {
    WASH_MACHINE_COMPLETED: { title: 'Wash Done 🧺',     body: `Your laundry is done! Please collect from ${machine || 'the machine'}.` },
    WASH_MACHINE_STARTED:   { title: 'Machine Started 🌀', body: `${machine || 'Your machine'} has started. We'll notify you when done.` },
    WASH_SLOT_BOOKED:       { title: 'Slot Booked ✅',    body: `Your washing machine slot is confirmed at ${blockId || 'your block'}.` },
    WASH_SLOT_CANCELLED:    { title: 'Slot Cancelled 🔄', body: `A slot was cancelled — machine is now available. ${reason || ''}`.trim() },
  };

  const { title, body } = messages[type] || {};
  if (!title) { console.warn(`⚠️  Unknown laundry type: ${type}`); return; }

  console.log(`📲 [laundry] ${title} → ${fcmTokens?.length || 0} token(s)`);
  const { successCount, failureCount } = await sendFCM({ tokens: fcmTokens, title, body, data: { type, machine: machine || '', blockId: blockId || '' } });

  await updateEventStatus(eventId, successCount, failureCount);
}

// ─────────────────────────────────────────
// DOMAIN — MESS
// ─────────────────────────────────────────

async function handleMess(job) {
  const { eventId, fcmTokens, type, mealType, refundAmount, reason } = job.data;

  const messages = {
    MESS_CHECKIN:           { title: 'Mess Check-in ✅',   body: `${mealType || 'Meal'} recorded successfully.` },
    MESS_ABSENT:            { title: 'Mess Absent 🍽️',    body: `You were marked absent for ${mealType || 'a meal'} today.` },
    MESS_REFUND_REQUESTED:  { title: 'Refund Requested 💰', body: `Your mess refund request has been received. ${reason || ''}`.trim() },
    MESS_REFUND_PROCESSED:  { title: 'Refund Processed 💸', body: `₹${refundAmount || 0} mess refund has been processed.` },
  };

  const { title, body } = messages[type] || {};
  if (!title) { console.warn(`⚠️  Unknown mess type: ${type}`); return; }

  console.log(`📲 [mess] ${title} → ${fcmTokens?.length || 0} token(s)`);
  const { successCount, failureCount } = await sendFCM({ tokens: fcmTokens, title, body, data: { type, mealType: mealType || '' } });

  await updateEventStatus(eventId, successCount, failureCount);
}

// ─────────────────────────────────────────
// HELPER — update Event document after sending
// ─────────────────────────────────────────

async function updateEventStatus(eventId, successCount, failureCount) {
  if (!eventId) return;
  try {
    await Event.findByIdAndUpdate(eventId, {
      status: 'completed',
      completedAt: new Date(),
      'deliveryStats.delivered': successCount,
      'deliveryStats.failed': failureCount,
      'deliveryStats.pending': 0,
    });
    console.log(`   📊 Event ${eventId} → completed (delivered: ${successCount}, failed: ${failureCount})`);
  } catch (err) {
    console.error(`   ⚠️  Could not update event ${eventId}:`, err.message);
  }
}

// ─────────────────────────────────────────
// WORKER
// ─────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`\n⚙️  Processing [${job.name}] — ${job.data.type}`);

    switch (job.name) {
      case 'transport-event': await handleTransport(job); break;
      case 'academic-event':  await handleAcademics(job); break;
      case 'laundry-event':   await handleLaundry(job);   break;
      case 'mess-event':      await handleMess(job);      break;
      default:
        console.warn(`⚠️  Unknown job name: ${job.name}`);
    }
  },
  { connection }
);

worker.on('completed', (job) =>
  console.log(`✅ [${job.name}] ${job.data.type} — done`)
);

worker.on('failed', (job, err) =>
  console.error(`❌ [${job.name}] ${job.data.type} — ${err.message}`)
);

console.log('🚀 Smart Campus Worker running...');
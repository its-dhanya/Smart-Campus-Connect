const { Worker, Queue } = require("bullmq");
const IORedis = require("ioredis");
const mongoose = require("mongoose");
const Student = require("./models/Student");

mongoose.connect("mongodb://localhost:27017/smartcampus");

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null
});

const QUEUE_NAME = "campus-events";
const eventQueue = new Queue(QUEUE_NAME, { connection });

// ─────────────────────────────────────────
// VALIDATE — every job must have these fields
// ─────────────────────────────────────────

const REQUIRED_FIELDS = ["id", "type", "domain", "entityId", "timestamp", "data"];

function validateEvent(event) {
  const missing = REQUIRED_FIELDS.filter(f => !event[f]);
  if (missing.length) {
    throw new Error(`Invalid event — missing fields: ${missing.join(", ")}`);
  }
}

// ─────────────────────────────────────────
// CORE FAN-OUT
// ─────────────────────────────────────────

async function getTokensForGroup(groupId) {
  const studentIds = await connection.smembers(`group:${groupId}`);
  if (!studentIds.length) return [];

  const students = await Student.find(
    { _id: { $in: studentIds } },
    { fcmToken: 1 }
  );

  return students.map(s => s.fcmToken).filter(Boolean);
}

async function pushNotification(groupId, title, message, payload = {}) {
  const tokens = await getTokensForGroup(groupId);
  if (!tokens.length) return;

  await eventQueue.add(QUEUE_NAME, {
    id:        `SEND_NOTIFICATION-${Date.now()}`,
    type:      "SEND_NOTIFICATION",
    domain:    "notification",
    entityId:  groupId,
    timestamp: new Date().toISOString(),
    data:      { tokens, title, message, payload }
  });
}

// ─────────────────────────────────────────
// DOMAIN — TRANSPORT
// ─────────────────────────────────────────

async function handleTransport(event) {
  // groupId stored in Redis when bus Group was created
  // e.g  redis.set('bus:BUS_052:groupId', 'GRP003')
  const groupId = await connection.get(`bus:${event.entityId}:groupId`);
  if (!groupId) return;

  const messages = {
    BUS_ARRIVED: {
      title:   "Bus Arrived 🚌",
      message: "Your bus has arrived at the stop."
    },
    BUS_DELAYED: {
      title:   "Bus Delayed ⏱️",
      message: `Your bus is running late. ${event.data?.reason || ""}`
    },
    BUS_CANCELLED: {
      title:   "Bus Cancelled ❌",
      message: `Bus ${event.entityId} has been cancelled today. ${event.data?.reason || ""}`
    },
  };

  const { title, message } = messages[event.type] || {};
  if (!title) return;

  await pushNotification(groupId, title, message, {
    busId:  event.entityId,
    type:   event.type,
    ...event.data
  });
}

// ─────────────────────────────────────────
// DOMAIN — ACADEMICS
// ─────────────────────────────────────────

async function handleAcademics(event) {
  // groupId sent by teacher's API call inside event.data
  const { groupId, ...details } = event.data;
  if (!groupId) return;

  const messages = {
    CLASS_CANCELLED: {
      title:   "Class Cancelled 📚",
      message: `Class has been cancelled. ${details?.reason || ""}`
    },
    CLASS_RESCHEDULED: {
      title:   "Class Rescheduled 🗓️",
      message: `Class moved to ${details?.newTime || "a new time"}. ${details?.reason || ""}`
    },
    EXAM_POSTPONED: {
      title:   "Exam Postponed 📝",
      message: `Exam has been postponed to ${details?.newDate || "a new date"}. ${details?.reason || ""}`
    },
  };

  const { title, message } = messages[event.type] || {};
  if (!title) return;

  await pushNotification(groupId, title, message, {
    type: event.type,
    ...details
  });
}

// ─────────────────────────────────────────
// DOMAIN — LAUNDRY
// ─────────────────────────────────────────

async function handleLaundry(event) {
  // entityId is the hostel block e.g "HOSTEL-A"
  const groupId = await connection.get(`laundry:${event.entityId}:groupId`);
  if (!groupId) return;

  const messages = {
    WASH_SLOT_BOOKED: {
      title:   "Slot Booked ✅",
      message: `Washing machine slot booked for ${event.data?.time || "your scheduled time"}.`
    },
    WASH_SLOT_CANCELLED: {
      title:   "Slot Cancelled 🔄",
      message: `A slot was cancelled — machine is now available.`
    },
    WASH_MACHINE_STARTED: {
      title:   "Machine Started 🌀",
      message: `Your wash has started. We'll notify you when it's done.`
    },
    WASH_MACHINE_COMPLETED: {
      title:   "Wash Done 🧺",
      message: `Your laundry is done! Please collect it.`
    },
  };

  const { title, message } = messages[event.type] || {};
  if (!title) return;

  await pushNotification(groupId, title, message, {
    type: event.type,
    ...event.data
  });
}

// ─────────────────────────────────────────
// DOMAIN — MESS
// ─────────────────────────────────────────

async function handleMess(event) {
  // mess events are per student — notify that student directly
  const student = await Student.findById(event.entityId, { fcmToken: 1 });
  if (!student?.fcmToken) return;

  const messages = {
    MESS_CHECKIN: {
      title:   "Mess Check-in ✅",
      message: `${event.data?.mealType || "Meal"} recorded at ${event.data?.time || "now"}.`
    },
    MESS_ABSENT: {
      title:   "Mess Absent 🍽️",
      message: `You were marked absent for ${event.data?.mealType || "a meal"} today.`
    },
    MESS_REFUND_REQUESTED: {
      title:   "Refund Requested 💰",
      message: `Your mess refund request for ${event.data?.month || "this month"} has been received.`
    },
    MESS_REFUND_PROCESSED: {
      title:   "Refund Processed 💸",
      message: `₹${event.data?.amount || 0} mess refund has been processed for ${event.data?.month || "this month"}.`
    },
  };

  const { title, message } = messages[event.type] || {};
  if (!title) return;

  // mess is per-student so push directly with their token
  await eventQueue.add(QUEUE_NAME, {
    id:        `SEND_NOTIFICATION-${Date.now()}`,
    type:      "SEND_NOTIFICATION",
    domain:    "notification",
    entityId:  event.entityId,
    timestamp: new Date().toISOString(),
    data: {
      tokens:  [student.fcmToken],
      title,
      message,
      payload: { type: event.type, ...event.data }
    }
  });
}

// ─────────────────────────────────────────
// WORKER
// ─────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const event = job.data;

    // validate every event before processing
    validateEvent(event);

    // route by domain first
    switch (event.domain) {

      case "transport":
        await handleTransport(event);
        break;

      case "academics":
        await handleAcademics(event);
        break;

      case "laundry":
        await handleLaundry(event);
        break;

      case "mess":
        await handleMess(event);
        break;

      case "notification":
        // final step — plug FCM in here
        console.log("📲 Sending to:", event.data.tokens);
        console.log("   Title:", event.data.title);
        console.log("   Message:", event.data.message);
        // await fcm.sendMulticast({ tokens: event.data.tokens, ... })
        break;

      default:
        console.warn(`⚠️  Unknown domain: ${event.domain}`);
        break;
    }
  },
  { connection }
);

worker.on("completed", (job) => console.log(`✅ [${job.data.domain}] ${job.data.type}`));
worker.on("failed",    (job, err) => console.error(`❌ [${job.data.domain}] ${job.data.type} — ${err.message}`));

console.log("🚀 Smart Campus Worker running...");
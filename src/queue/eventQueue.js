const { Worker, Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null
});

const QUEUE_NAME = "campus-events";
const eventQueue = new Queue(QUEUE_NAME, { connection });

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

const busSchedule = {
    "BUS_1": {
        stopLat: 12.9716,
        stopLon: 77.5946,
        scheduledArrival: new Date(Date.now() + 2 * 60 * 1000),
        arrived: false,
        delayed: false
    }
};

const ARRIVAL_RADIUS_KM = 0.1;
const GRACE_PERIOD_MINUTES = 5;

const messAttendance = new Map();
const COST_PER_DAY = 50;

let activeMachines = 0;
const MAX_MACHINES = 3;
let lastStatus = "FREE";

function emitTransportEvent(type, busId) {
    eventQueue.add(QUEUE_NAME, {
        id: `${type}-${busId}-${Date.now()}`,
        type,
        entityId: busId,
        entityType: "BUS",
        timestamp: new Date().toISOString(),
        source: "worker-service",
        data: {}
    });
}

function emitAcademicNotification(event) {
    eventQueue.add(QUEUE_NAME, {
        id: `ACADEMIC_NOTIFICATION-${Date.now()}`,
        type: "ACADEMIC_NOTIFICATION",
        entityId: event.entityId,
        entityType: "CLASS",
        timestamp: new Date().toISOString(),
        source: "worker-service",
        data: {
            originalType: event.type,
            details: event.data
        }
    });
}

function emitLaundryEvent(type) {
    eventQueue.add(QUEUE_NAME, {
        id: `${type}-${Date.now()}`,
        type,
        entityId: "HOSTEL-A",
        entityType: "HOSTEL",
        timestamp: new Date().toISOString(),
        source: "worker-service",
        data: {
            activeMachines,
            maxMachines: MAX_MACHINES
        }
    });
}

function handleTransport(event) {
    if (event.type !== "BUS_LOCATION_UPDATED") {
        return;
    }

    const busId = event.entityId;
    const { latitude, longitude, timestamp } = event.data;

    const schedule = busSchedule[busId];
    if (!schedule) {
        return;
    }

    const distanceToStop = calculateDistance(
        latitude,
        longitude,
        schedule.stopLat,
        schedule.stopLon
    );

    if (!schedule.arrived && distanceToStop <= ARRIVAL_RADIUS_KM) {
        schedule.arrived = true;
        emitTransportEvent("BUS_ARRIVED", busId);
        return;
    }

    if (!schedule.arrived && !schedule.delayed) {
        const now = new Date(timestamp);
        const graceTime = new Date(schedule.scheduledArrival);
        graceTime.setMinutes(graceTime.getMinutes() + GRACE_PERIOD_MINUTES);

        if (now > graceTime) {
            schedule.delayed = true;
            emitTransportEvent("BUS_DELAYED", busId);
        }
    }
}

function handleAcademics(event) {
    if (event.type === "CLASS_CANCELLED") {
        emitAcademicNotification(event);
    }

    if (event.type === "HALL_CHANGE") {
        emitAcademicNotification(event);
    }
}

function handleMess(event) {
    const studentId = event.entityId;
    const date = event.data.date;

    if (!messAttendance.has(studentId)) {
        messAttendance.set(studentId, new Set());
    }

    messAttendance.get(studentId).add(date);
}

function calculateMessRefund(studentId, year, month) {
    const presentDays = messAttendance.get(studentId)?.size || 0;
    const totalDaysInMonth = getDaysInMonth(year, month);
    const absentDays = totalDaysInMonth - presentDays;
    const refundAmount = absentDays * COST_PER_DAY;

    return {
        studentId,
        year,
        month,
        presentDays,
        absentDays,
        refundAmount
    };
}

function handleLaundry(event) {
    if (event.type === "WASH_MACHINE_USED") {
        activeMachines++;
    }

    if (event.type === "WASH_MACHINE_RELEASED") {
        activeMachines = Math.max(0, activeMachines - 1);
    }

    const currentStatus =
        activeMachines >= MAX_MACHINES ? "FULL" : "FREE";

    if (currentStatus !== lastStatus) {
        if (currentStatus === "FULL") {
            emitLaundryEvent("WASH_FULL");
        }

        if (currentStatus === "FREE") {
            emitLaundryEvent("WASH_AVAILABLE");
        }

        lastStatus = currentStatus;
    }
}

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const event = job.data;

        switch (event.type) {
            case "BUS_LOCATION_UPDATED":
                handleTransport(event);
                break;

            case "BUS_DELAYED":
            case "BUS_CANCELLED":
            case "BUS_ARRIVED":
                handleTransport(event);
                break;

            case "CLASS_CANCELLED":
            case "HALL_CHANGE":
                handleAcademics(event);
                break;

            case "MESS_CHECKIN":
                handleMess(event);
                break;

            case "CALCULATE_MESS_REFUND":
                calculateMessRefund(
                    event.entityId,
                    event.data.year,
                    event.data.month
                );
                break;

            case "WASH_MACHINE_USED":
            case "WASH_MACHINE_RELEASED":
                handleLaundry(event);
                break;

            default:
                break;
        }
    },
    { connection }
);

worker.on("completed", () => {});

worker.on("failed", () => {});

console.log("Smart Campus Worker running");
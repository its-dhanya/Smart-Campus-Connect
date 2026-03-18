# Smart Campus Connect

A real-time campus notification and management system for hostels. Students receive instant push notifications for bus alerts, class cancellations, laundry slot bookings, and mess updates. Admins manage their respective domains through role-scoped dashboards.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Roles & Permissions](#roles--permissions)
7. [Data Models](#data-models)
8. [API Reference](#api-reference)
9. [Domain Logic](#domain-logic)
10. [Frontend](#frontend)
11. [Push Notifications (FCM)](#push-notifications-fcm)
12. [Event Queue (BullMQ)](#event-queue-bullmq)
13. [Business Rules](#business-rules)
14. [Known Limitations](#known-limitations)

---

## Architecture Overview

### System architecture
<p align="center">
  <img src="images/overallflow.png" width="500"/>
</p>

### Event notification flow
<p align="center">
  <img src="images/sysflow.png" width="500"/>
</p>

### Data Model
<p align="center">
  <img src="images/data_arch.png" width="500"/>
</p>

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| `express` | HTTP server and routing |
| `mongoose` | MongoDB ODM |
| `jsonwebtoken` | JWT auth tokens |
| `bcryptjs` | Password hashing |
| `bullmq` | Redis-backed job queue for async notification delivery |
| `ioredis` | Redis client |
| `firebase-admin` | Server-side FCM push notification sending |
| `dotenv` | Environment variable loading |

### Frontend
| Package | Purpose |
|---|---|
| `react` 18 | UI framework |
| `vite` | Build tool and dev server |
| `firebase` | Client-side FCM token registration and foreground message handling |

---

## Project Structure

```
backend/
└── src/
    ├── app.js                    # Express app setup, route mounting
    ├── server.js                 # HTTP server entry point
    ├── config/
    │   ├── dbConnect.js          # MongoDB connection
    │   └── fireBaseAdmin.js      # Firebase Admin SDK init
    ├── models/
    │   ├── Student.js            # User model (all roles share one collection)
    │   ├── Group.js              # Notification groups (courses, buses, hostels, mess)
    │   ├── Subscription.js       # Student ↔ Group membership + dismissed events
    │   └── Event.js              # Fired event log with delivery tracking
    ├── middleware/
    │   ├── authMiddleware.js     # JWT verification, role guards
    │   └── eventPermission.js   # Per-event-type role restrictions
    ├── controllers/
    │   ├── authController.js
    │   ├── studentController.js  # Profile, notifications (with TTL + dismiss)
    │   ├── adminController.js    # User management, stats, queue status
    │   ├── groupController.js
    │   ├── subscriptionController.js
    │   ├── academicController.js # Course groups, academic event firing
    │   ├── transportController.js# Bus groups, bus event firing
    │   ├── laundryController.js  # Slot booking, auto-transition sweep
    │   ├── messController.js     # Meal check-ins, monthly refund summaries
    │   └── eventQueue.js
    ├── routes/                   # One file per domain
    ├── queue/
    │   └── eventQueue.js         # BullMQ queue instance
    ├── services/
    │   └── fcmService.js         # Multicast and single FCM send
    ├── validators/
    │   └── event.validate.js
    └── shared/
        └── event.schema.json

frontend/
└── src/
    ├── App.jsx                   # Auth state, FCM setup, role routing
    ├── main.jsx
    ├── context/
    │   ├── AuthContext.jsx
    │   └── ToastContext.jsx
    ├── lib/
    │   ├── api.js                # Typed fetch wrapper (get/post/put/delete)
    │   ├── firebase.js           # requestFCMToken, onForegroundMessage
    │   └── firebase-messaging-sw.js
    ├── components/
    │   ├── Layout.jsx            # Sidebar, topbar, role-based nav
    │   └── EventFirer.jsx        # Academic course dropdown + generic event firer
    └── pages/
        ├── LoginPage.jsx
        ├── Studentdashboard.jsx  # Notifications, Laundry, Mess, Groups, Profile
        └── Admindashboard.jsx    # Overview, Users, Groups, Notifications, domain dashboards
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local, default port 6379)
- A Firebase project with Cloud Messaging enabled

### Backend

```bash
cd backend
npm install

# Create .env (see Environment Variables section)
cp .env.example .env

npm start
# Server runs on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Dev server runs on http://localhost:5173
```

### Default Admin Account

On first startup, the backend auto-creates a super admin account:

```
Email:    admin@smartcampus.com
Password: admin123
Role:     SUPER_ADMIN
```

Change this password immediately after first login.

---

## Environment Variables

Create a `.env` file in the `backend/src` directory:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/smart-campus

# JWT
JWT_SECRET_KEY=your_jwt_secret_here

# Redis (BullMQ)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Server
PORT=3000

# Firebase Admin SDK
# Download the service account JSON from Firebase Console →
# Project Settings → Service Accounts → Generate new private key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Roles & Permissions

All users (students and admins) are stored in the same `Student` collection. The `role` field determines access.

| Role | Dashboard | Can Fire Events | Domain Access |
|---|---|---|---|
| `SUPER_ADMIN` | Full admin dashboard | All event types | Everything |
| `TEACHER` | Admin — Fire Event (academics only) | `CLASS_CANCELLED`, `CLASS_RESCHEDULED`, `EXAM_POSTPONED` | Own assigned courses only |
| `BUS_ADMIN` | Admin — Notifications, Fire Event | `BUS_DELAYED`, `BUS_CANCELLED`, `BUS_ARRIVED` | Assigned bus only |
| `LAUNDRY_ADMIN` | Admin — Laundry Dashboard (read-only) | None (all automatic) | Assigned hostel block |
| `MESS_ADMIN` | Admin — Mess Dashboard, Process Refund | `MESS_REFUND_PROCESSED` | Main mess |
| `STUDENT` | Student dashboard | None | Subscribed groups |

### Event Permission Enforcement

Two layers of auth sit in front of every event-firing endpoint:

1. `verifyToken` — validates the JWT and attaches `req.user`
2. `checkEventPermissions` — checks `EVENT_PERMISSIONS[role].includes(eventType)`. `SUPER_ADMIN` bypasses this check entirely.

---

## Data Models

### Entity relationship diagram

![Data model](docs/data-model.svg)

### Student

```js
{
  email:           String (unique, required),
  password:        String (hashed, bcrypt),
  name:            String,
  rollNo:          String (unique),
  department:      String,
  semester:        Number,
  hostelBlock:     String,
  role:            'SUPER_ADMIN' | 'TEACHER' | 'BUS_ADMIN' | 'LAUNDRY_ADMIN' | 'MESS_ADMIN' | 'STUDENT',
  groups:          [ObjectId → Group],   // for TEACHER RBAC
  fcmToken:        String,               // device push token, auto-set on login
  dismissedEvents: [ObjectId → Event],   // admin-dismissed notifications
  createdAt, updatedAt
}
```

### Group

A group represents a notification channel. Students subscribe to groups to receive events.

```js
{
  name:    String,                             // e.g. "CS301 - Data Structures"
  type:    'TEACHER' | 'BUS' | 'LAUNDRY' | 'MESS',
  ownerId: String,                             // e.g. "CS301", "BUS_052", "HOSTEL-A", "MAIN_MESS"
  createdAt, updatedAt
}
```

### Subscription

Links a student to a group. Also stores per-student dismissed event IDs.

```js
{
  studentId:       ObjectId → Student,
  groupId:         ObjectId → Group,
  dismissedEvents: [ObjectId → Event],    // events this student has manually dismissed
  createdAt, updatedAt
}
// Unique index on { studentId, groupId }
```

### Event

The canonical record of every notification fired.

```js
{
  domain:   'transport' | 'academics' | 'laundry' | 'mess',
  type:     String,                        // e.g. BUS_DELAYED, CLASS_CANCELLED
  groupId:  ObjectId → Group,
  entityId: String,                        // e.g. BUS_052, HOSTEL-A
  metadata: Mixed,                         // domain-specific payload (see below)
  firedBy:  String,                        // admin's display name
  status:   'pending' | 'processing' | 'completed' | 'failed',
  deliveryStats: { total, delivered, failed, pending },
  errors:   [{ studentId, error, timestamp }],
  createdAt, updatedAt, completedAt
}
```

#### Metadata shapes by domain

```js
// Academics
{ courseCode: "CS301", courseName: "Data Structures", reason, newTime, newHall }

// Transport
{ busId: "BUS_052", reason, delay }

// Laundry
{ machine: "M1", block: "HOSTEL-A", date: "2026-03-19", time: "09:00", studentId }

// Mess — check-in
{ studentId, studentName, mealType: "lunch", date: "2026-03-18" }

// Mess — refund requested
{ studentId, studentName, month: "2026-03", refundAmount: 480, mealsMissed: 6 }

// Mess — refund processed
{ studentId, refundAmount, month }
```

---

## API Reference

All endpoints except `/auth/login` and `/auth/register` require:
```
Authorization: Bearer <jwt_token>
```

### Auth — `/auth`

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | Returns JWT token + student object |
| POST | `/auth/register` | `{ email, password, name, rollNo, ... }` | Register new student |

### Students — `/students`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:id` | Any | Get student profile |
| PUT | `/:id` | Own or SUPER_ADMIN | Update profile |
| PUT | `/:id/fcm-token` | Own | Update FCM push token |
| GET | `/:id/groups` | Own | Get subscribed groups |
| GET | `/:id/notifications` | Own | Get notifications (last 24 h, non-dismissed) |
| DELETE | `/:id/notifications/:eventId` | Own | Dismiss a notification |

**Notifications response shape:**
```json
{
  "notifications": [
    {
      "id": "...",
      "domain": "academics",
      "type": "CLASS_CANCELLED",
      "metadata": { "courseCode": "CS301", "courseName": "Data Structures", "reason": "Faculty unwell" },
      "firedBy": "Prof. Smith",
      "timestamp": "2026-03-18T10:00:00Z",
      "expiresAt": "2026-03-19T10:00:00Z"
    }
  ],
  "ttlHours": 24
}
```

### Admin — `/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | SUPER_ADMIN | System-wide stats |
| GET | `/queue-status` | SUPER_ADMIN | BullMQ queue metrics |
| GET | `/users` | SUPER_ADMIN | All users |
| POST | `/users` | SUPER_ADMIN | Create user |
| PUT | `/users/:id` | SUPER_ADMIN | Update user |
| DELETE | `/users/:id` | SUPER_ADMIN | Delete user |
| POST | `/resend-notifications/:eventId` | SUPER_ADMIN | Retry failed event delivery |

### Groups — `/groups`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any admin | List all groups |
| POST | `/` | SUPER_ADMIN | Create group |

### Subscriptions — `/subscriptions`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Any | Subscribe student to group |
| DELETE | `/:id` | Own or admin | Unsubscribe |
| GET | `/student/:studentId` | Own | Get student's subscriptions |
| GET | `/group/:groupId` | Admin | Get group's subscribers |

### Academics — `/academics`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | TEACHER, SUPER_ADMIN | List courses (TEACHER sees own only) |
| POST | `/` | SUPER_ADMIN | Create academic group |
| GET | `/:id` | TEACHER, SUPER_ADMIN | Course details + subscriber list |
| PUT | `/:id` | SUPER_ADMIN | Update course |
| DELETE | `/:id` | SUPER_ADMIN | Delete course |
| POST | `/event` | TEACHER, SUPER_ADMIN | Fire academic event |
| GET | `/events/:groupId` | TEACHER, SUPER_ADMIN | Recent events for a course |

**Fire academic event body:**
```json
{
  "eventType": "CLASS_CANCELLED",
  "groupId": "<mongodb_id>",
  "reason": "Faculty unwell",
  "newTime": "3:00 PM",
  "newHall": "LH-3"
}
```
> `newTime` and `newHall` are only relevant for `CLASS_RESCHEDULED`. `newTime` is optional for `EXAM_POSTPONED`.

### Transport — `/bus`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List bus groups |
| POST | `/` | SUPER_ADMIN | Create bus group |
| POST | `/event` | BUS_ADMIN, SUPER_ADMIN | Fire bus event |

**Fire bus event body:**
```json
{
  "eventType": "BUS_DELAYED",
  "busId": "BUS_052",
  "reason": "Heavy traffic",
  "delay": 15
}
```

### Laundry — `/laundry`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/slots/available` | Student | `?block=HOSTEL-A&date=YYYY-MM-DD` |
| POST | `/slots/book` | Student | Book slot for tomorrow. Body: `{ block, machine, time }` |
| GET | `/my-bookings` | Student | Student's own bookings |
| DELETE | `/slots/cancel` | Student | `?block&date&machine&time` |
| GET | `/dashboard/:block` | LAUNDRY_ADMIN, SUPER_ADMIN | `?date=YYYY-MM-DD` |

### Mess — `/mess`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/checkin` | Student | Check in for today's meal. Body: `{ mealType }` |
| GET | `/meals/:date` | Student (today only) | Meal check-ins for a date |
| GET | `/monthly-summary` | Student | `?month=YYYY-MM` |
| POST | `/request-refund` | Student | Body: `{ month }` |
| GET | `/admin/daily-checkins` | MESS_ADMIN, SUPER_ADMIN | `?date=YYYY-MM-DD` |
| GET | `/admin/monthly-report` | MESS_ADMIN, SUPER_ADMIN | `?month=YYYY-MM` |

---

## Domain Logic

### Laundry — Automatic Slot Lifecycle

Slots are managed entirely in-memory (no separate MongoDB collection). On every read operation a sweep runs:

```
booked  →  in-use     at slot start time (e.g. booking for 09:00 activates at 09:00)
in-use  →  available  1 hour after slot start (slot freed at 10:00)
booked  →  available  if still unstarted 1 hour after slot start (student no-show)
```

No admin action is needed — no "mark started" or "mark completed" buttons exist. The `LAUNDRY_ADMIN` dashboard is read-only.

**Booking rules:**
- Students can only book for **tomorrow** — not today, not further ahead
- Only **one booking per student per day** is allowed
- Bookings are made without sending a date; the server derives tomorrow

**Slot statuses:**

| Status | Color | Meaning |
|---|---|---|
| `available` | Green | Can be booked |
| `booked` | Amber | Reserved, not yet started |
| `in-use` | Blue | Wash running |
| `completed` | Gray | Done (historical) |
| `cancelled` | Red | Cancelled by student |

### Mess — Today-Only Check-in

- Students can only check in for **today's date** — the server ignores any date sent in the body and always uses `new Date()`
- Students can only view meal data for today via `GET /mess/meals/:date`; admins can query any date
- Cost is ₹80/meal. Missed meals accumulate for monthly refund calculation

### Notifications — TTL and Dismissal

- All notifications expire **24 hours** after creation. The backend enforces this with a `createdAt: { $gte: cutoff }` filter
- Each notification includes an `expiresAt` timestamp; the frontend auto-removes locally-expired items every 60 seconds
- Students and admins can dismiss individual notifications. Dismissed event IDs are stored on:
  - **Students**: in `Subscription.dismissedEvents` (per group)
  - **Admins**: in `Student.dismissedEvents` (direct, since admins have no subscriptions)
- Old academic events that stored a raw MongoDB ObjectId in `metadata.courseCode` are patched at query time — the backend resolves the real `ownerId` and `name` from the Group document before returning the response

---

## Frontend

### Routing by Role

`App.jsx` renders either `<AdminDashboard>` or `<StudentDashboard>` based on the authenticated user's role. Navigation items are defined per-role in `Layout.jsx`:

| Role | Nav items |
|---|---|
| SUPER_ADMIN | Overview, Users, Groups, Fire Event, Queue |
| TEACHER | Overview, Notifications, Fire Event |
| BUS_ADMIN | Overview, Notifications, Fire Event |
| LAUNDRY_ADMIN | Overview, Notifications, Laundry Dashboard |
| MESS_ADMIN | Overview, Notifications, Mess Dashboard, Process Refund |
| STUDENT | Notifications, Laundry, Mess, My Groups, Profile |

### EventFirer Component

The `EventFirer` component adapts based on role:

- **TEACHER** → `AcademicEventFirer`: fetches the teacher's assigned courses from `GET /academics` and renders them as a dropdown. After selecting a course, event type chips appear. Only the fields relevant to the chosen event type are shown (e.g. `CLASS_CANCELLED` shows only Reason; `CLASS_RESCHEDULED` shows Reason + New time + New hall).

- **BUS_ADMIN** / **MESS_ADMIN** → `GenericEventFirer`: domain is pre-selected implicitly; only the relevant event types and fields are shown per selection.

- **SUPER_ADMIN** → `SuperAdminEventFirer`: tab switcher between Academics and Transport & Mess.

### Notification Display

The `formatNotification(n)` function converts raw event data into human-readable strings:

| Event type | Example title | Example detail |
|---|---|---|
| CLASS_CANCELLED | `CS301 — Data Structures cancelled` | `Faculty unwell` |
| CLASS_RESCHEDULED | `CS301 — Data Structures rescheduled` | `Clashing exam · New time: 3:00 PM · Hall: LH-3` |
| BUS_DELAYED | `BUS_052 delayed` | `~15 min late · Heavy traffic` |
| WASH_SLOT_BOOKED | `M1 booked at 09:00` | `HOSTEL-A · 2026-03-19` |
| MESS_REFUND_REQUESTED | `Refund requested` | `2026-03 · ₹480 · 6 meals missed` |

---

## Push Notifications (FCM)

### How it works

1. On login, `App.jsx` calls `requestFCMToken()` from `firebase.js`
2. The browser prompts for notification permission
3. If granted, Firebase returns a unique device token
4. The token is saved to the backend via `PUT /students/:id/fcm-token`
5. When an admin fires an event, the backend reads all subscribers' `fcmToken` fields
6. `fcmService.js` calls Firebase's multicast API to deliver a push notification to all devices simultaneously
7. If the browser tab is open, `onForegroundMessage` intercepts the message and shows it as an in-app toast instead

### Service Worker

`public/firebase-messaging-sw.js` handles background notifications (when the tab is closed or the app is not focused). It must be served from the root of the domain.

### Firebase Setup

1. Go to Firebase Console → Project Settings → Your apps → Add a web app
2. Copy the config object into `src/lib/firebase.js`
3. Go to Cloud Messaging → Web Push certificates → Generate key pair
4. Copy the VAPID key into the `vapidKey` field in `requestFCMToken()`
5. Download the service account private key for the backend and set the env vars

---

## Event Queue (BullMQ)

All push notification delivery is asynchronous via BullMQ backed by Redis.

**Queue name:** `campus-events`

**Job types:** `academic-event`, `bus-event`, `laundry-event`, `mess-event`

**Job options:** 3 retry attempts with exponential backoff (2s base delay)

**Monitoring:** `GET /admin/queue-status` returns `{ waiting, active, completed, failed, delayed }`. Failed jobs can be retried via `POST /admin/resend-notifications/:eventId`.

To run the worker (processes jobs and sends FCM):
```bash
node src/queue/worker.js
```

---

## Business Rules

| Rule | Where enforced |
|---|---|
| Laundry bookings only for tomorrow | `laundryController.bookLaundrySlot` (server derives date) |
| One laundry booking per student per day | `laundryController.bookLaundrySlot` (scans existing bookings) |
| Laundry slot auto-released 1h after start if unused | `sweepExpiredBookings()` called on every read |
| Mess check-in only for today | `messController.checkInMeal` (server derives date) |
| Students can only view today's mess data | `messController.getMyMealsForDate` (403 for non-today) |
| Notifications expire after 24h | `studentController.getStudentNotifications` TTL cutoff |
| TEACHER can only fire events for assigned courses | `academicController.fireAcademicEvent` checks `req.user.groups` |
| LAUNDRY_ADMIN can fire no events (all automatic) | `eventPermission.js` — empty array |
| MESS_ADMIN can only fire `MESS_REFUND_PROCESSED` | `eventPermission.js` |
| Admin notification feed scoped to their domain | `studentController` — `ROLE_TO_GROUP_TYPES` map |
| Stale ObjectId courseCode patched at query time | `studentController.getStudentNotifications` |

---

## Known Limitations

- **Laundry slots are in-memory only.** Restarting the server clears all bookings. For production, migrate the `slots` object to a MongoDB collection.
- **Mess check-ins are in-memory only.** Same as above — restart clears all data. Migrate `mealCheckins` to MongoDB.
- **No email notifications.** The system only supports FCM push. Email (via Nodemailer/Resend) is not yet integrated.
- **Single bus per BUS_ADMIN.** `BUS_ADMIN` is currently hardcoded to `BUS_052`. To support multiple buses per admin, the `groups` array on the Student model should be used (same pattern as TEACHER).
- **No real-time sync.** The frontend polls on page load and on explicit refresh. WebSocket/SSE would eliminate the need to manually refresh the notifications tab.
- **CORS is locked to `localhost:5173`.** Update `app.js` before deploying to production.

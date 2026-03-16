# Smart Campus Connect

An Event-Driven Notification System for campus services — academics, transport, mess, and laundry — with Role-Based Access Control (RBAC) and BullMQ-powered async notification delivery.

---

## Architecture

```
Client → Express API → MongoDB
                    ↓
              BullMQ Queue (Redis)
                    ↓
              Worker Process → FCM Push Notifications
```

---

## Prerequisites

| Tool       | Version  | Install                          |
|------------|----------|----------------------------------|
| Node.js    | 18+      | https://nodejs.org               |
| MongoDB    | 6+       | `brew install mongodb-community` |
| Redis      | 7+       | `brew install redis`             |

**Start services (macOS):**
```bash
brew services start mongodb-community
brew services start redis
```

**Start services (Ubuntu):**
```bash
sudo systemctl start mongod
sudo systemctl start redis
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (edit as needed)
cp .env .env.local   # optional — .env already has defaults

# 3. Start the API server
npm run dev          # development (nodemon)
npm start            # production

# 4. Start the BullMQ worker (separate terminal)
npm run worker:dev   # development
npm run worker       # production
```

The API starts on **http://localhost:5000**.  
A default `SUPER_ADMIN` account is auto-created on first boot.

---

## Default Admin

| Field    | Value                    |
|----------|--------------------------|
| Email    | admin@smartcampus.com    |
| Password | 12345678                 |

⚠️ Change the password and `JWT_SECRET_KEY` before deploying.

---

## Roles & Permissions

| Role           | Domain Access              | Entity Scope          |
|----------------|----------------------------|-----------------------|
| `SUPER_ADMIN`  | Everything                 | All                   |
| `TEACHER`      | Academics only             | GRP001, GRP002        |
| `BUS_ADMIN`    | Transport only             | BUS_052               |
| `LAUNDRY_ADMIN`| Laundry only               | HOSTEL-A              |
| `MESS_ADMIN`   | Mess only                  | MAIN_MESS             |
| `STUDENT`      | Read own data & notifs     | Own profile/groups    |

---

## API Reference

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### Auth
| Method | Route              | Access  | Description           |
|--------|--------------------|---------|-----------------------|
| POST   | /auth/register     | Public  | Register student      |
| POST   | /auth/login        | Public  | Login, get JWT        |
| POST   | /auth/refresh      | Public  | Refresh token         |
| POST   | /auth/logout       | Public  | Logout                |

### Students
| Method | Route                        | Access          |
|--------|------------------------------|-----------------|
| GET    | /students/:id                | Self or Admin   |
| PUT    | /students/:id                | Self or SUPER   |
| PUT    | /students/:id/fcm-token      | Self            |
| GET    | /students/:id/groups         | Self or Admin   |
| GET    | /students/:id/notifications  | Self            |

### Groups
| Method | Route                         | Access       |
|--------|-------------------------------|--------------|
| GET    | /groups                       | All (scoped) |
| POST   | /groups                       | SUPER_ADMIN  |
| GET    | /groups/:id                   | All (scoped) |
| PUT    | /groups/:id                   | SUPER_ADMIN  |
| DELETE | /groups/:id                   | SUPER_ADMIN  |
| GET    | /groups/:id/members           | Admin        |
| POST   | /groups/:id/members           | SUPER_ADMIN  |
| DELETE | /groups/:id/members/:sid      | SUPER_ADMIN  |

### Subscriptions
| Method | Route                            | Access         |
|--------|----------------------------------|----------------|
| POST   | /subscriptions                   | Self or Admin  |
| DELETE | /subscriptions/:id               | Self or Admin  |
| GET    | /subscriptions/student/:sid      | Self or Admin  |
| GET    | /subscriptions/group/:gid        | Admin only     |

### Events
| Method | Route                    | Access         |
|--------|--------------------------|----------------|
| POST   | /events                  | Domain Admins  |
| GET    | /events                  | Auth users     |
| GET    | /events/:id              | Auth users     |
| GET    | /events/domain/:domain   | Domain Admins  |
| GET    | /events/queue/status     | SUPER_ADMIN    |

### Academics `/academics`
| Method | Route                    | Access              |
|--------|--------------------------|---------------------|
| GET    | /                        | TEACHER + SUPER     |
| POST   | /                        | SUPER_ADMIN         |
| POST   | /event                   | TEACHER + SUPER     |
| GET    | /events/:groupId         | TEACHER + SUPER     |
| GET    | /:id                     | TEACHER + SUPER     |
| PUT    | /:id                     | SUPER_ADMIN         |
| DELETE | /:id                     | SUPER_ADMIN         |

**Event types:** `CLASS_CANCELLED`, `CLASS_RESCHEDULED`, `EXAM_POSTPONED`

### Transport `/bus`
| Method | Route              | Access             |
|--------|--------------------|--------------------|
| GET    | /                  | BUS_ADMIN + SUPER  |
| POST   | /                  | SUPER_ADMIN        |
| POST   | /event             | BUS_ADMIN + SUPER  |
| GET    | /status/:busId     | BUS_ADMIN + SUPER  |
| GET    | /events/:busId     | BUS_ADMIN + SUPER  |
| GET    | /:id               | BUS_ADMIN + SUPER  |
| PUT    | /:id               | BUS_ADMIN + SUPER  |
| DELETE | /:id               | SUPER_ADMIN        |

**Event types:** `BUS_DELAYED`, `BUS_CANCELLED`, `BUS_ARRIVED`

### Mess `/mess`
| Method | Route                | Access               |
|--------|----------------------|----------------------|
| GET    | /                    | MESS_ADMIN + SUPER   |
| POST   | /                    | SUPER_ADMIN          |
| POST   | /event               | MESS_ADMIN + SUPER   |
| GET    | /checkins/:date      | MESS_ADMIN + SUPER   |
| POST   | /refund              | MESS_ADMIN + SUPER   |
| GET    | /events/:messId      | MESS_ADMIN + SUPER   |
| GET    | /summary/:month      | MESS_ADMIN + SUPER   |
| GET    | /:id                 | MESS_ADMIN + SUPER   |
| PUT    | /:id                 | MESS_ADMIN + SUPER   |
| DELETE | /:id                 | SUPER_ADMIN          |

**Event types:** `MESS_CHECKIN`, `MESS_ABSENT`, `MESS_REFUND_REQUESTED`, `MESS_REFUND_PROCESSED`

### Laundry `/laundry`
| Method | Route                    | Access                  |
|--------|--------------------------|-------------------------|
| GET    | /                        | LAUNDRY_ADMIN + SUPER   |
| POST   | /                        | SUPER_ADMIN             |
| POST   | /event                   | LAUNDRY_ADMIN + SUPER   |
| GET    | /machines/:blockId       | LAUNDRY_ADMIN + SUPER   |
| GET    | /events/:blockId         | LAUNDRY_ADMIN + SUPER   |
| GET    | /:id                     | LAUNDRY_ADMIN + SUPER   |
| PUT    | /:id                     | LAUNDRY_ADMIN + SUPER   |
| DELETE | /:id                     | SUPER_ADMIN             |

**Event types:** `WASH_MACHINE_COMPLETED`, `WASH_SLOT_CANCELLED`, `WASH_MACHINE_STARTED`, `WASH_SLOT_BOOKED`

### Admin `/admin`
| Method | Route                              | Access      |
|--------|------------------------------------|-------------|
| POST   | /users                             | SUPER_ADMIN |
| GET    | /users                             | SUPER_ADMIN |
| GET    | /users/:id                         | SUPER_ADMIN |
| PUT    | /users/:id                         | SUPER_ADMIN |
| DELETE | /users/:id                         | SUPER_ADMIN |
| GET    | /stats                             | SUPER_ADMIN |
| GET    | /queue-status                      | SUPER_ADMIN |
| POST   | /resend-notifications/:eventId     | SUPER_ADMIN |

---

## Example Requests

### Login
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcampus.com","password":"12345678"}'
```

### Fire a bus event
```bash
curl -X POST http://localhost:5000/bus/event \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"BUS_DELAYED","busId":"BUS_052","reason":"Heavy traffic"}'
```

### Fire a class cancellation
```bash
curl -X POST http://localhost:5000/academics/event \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"CLASS_CANCELLED","groupId":"<mongodb_group_id>","reason":"Faculty unwell"}'
```

### Subscribe a student to a group
```bash
curl -X POST http://localhost:5000/subscriptions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<student_id>","groupId":"<group_id>"}'
```

---

## Integrating FCM (Push Notifications)

The worker currently logs notifications to console. To enable real push:

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

2. Add your service account key to `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```

3. In `worker.js`, replace the `notification` case:
   ```js
   const admin = require('firebase-admin');
   admin.initializeApp({ credential: admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) });

   // Inside the 'notification' case:
   await admin.messaging().sendEachForMulticast({
     tokens: event.data.tokens,
     notification: { title: event.data.title, body: event.data.message },
     data: event.data.payload,
   });
   ```

---

## Project Structure

```
Smart-Campus-Connect/
├── src/
│   ├── app.js                   # Express app setup
│   ├── server.js                # Entry point
│   ├── config/
│   │   └── dbConnect.js         # Mongoose connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   ├── studentController.js
│   │   ├── groupController.js
│   │   ├── subscriptionController.js
│   │   ├── academicController.js
│   │   ├── transportController.js
│   │   ├── messController.js
│   │   └── laundryController.js
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verify + role guards
│   │   └── eventPermission.js  # Event-type permission check
│   ├── models/
│   │   ├── Student.js
│   │   ├── Group.js
│   │   ├── Event.js
│   │   └── Subscription.js
│   ├── queue/
│   │   └── eventQueue.js       # BullMQ Queue instance
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── studentRoutes.js
│   │   ├── groupRoutes.js
│   │   ├── subscriptionRoutes.js
│   │   ├── eventRoutes.js
│   │   ├── academicRoutes.js
│   │   ├── transportRoutes.js
│   │   ├── messRoutes.js
│   │   └── laundryRoutes.js
│   ├── shared/
│   │   └── event.schema.json
│   └── validators/
│       └── event.validate.js
├── worker.js                    # BullMQ worker process
├── package.json
└── .env
```
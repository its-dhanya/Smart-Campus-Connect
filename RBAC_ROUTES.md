# Smart Campus RBAC Routes Documentation

This document outlines all routes tailored according to the RBAC structure defined in `smart-campus-rbac.html`.

---

## 📋 Roles & Permissions Summary

### 1. **SUPER_ADMIN** 🛡️
- **User**: Arjun Mehta
- **Access Level**: Full system access
- **Capabilities**:
  - View all events across all domains
  - Fire events in any domain
  - Create/manage users and groups
  - View all group subscribers
  - Access queue status

### 2. **TEACHER** 👩‍🏫
- **User**: Prof. Smith
- **Assigned Groups**: GRP001 (CS101 - 62 students), GRP002 (CS202 - 55 students)
- **Access Level**: Academic domain only
- **Capabilities**:
  - View only assigned courses (GRP001, GRP002)
  - Fire academic events to assigned groups only
  - Access Denied: Transport, Laundry, Mess domains

### 3. **BUS_ADMIN** 🚌
- **User**: Ravi Kumar
- **Assigned Bus**: BUS_052 (Route 42, GRP003 - 34 students)
- **Access Level**: Transport domain + assigned bus only
- **Capabilities**:
  - View only assigned bus (BUS_052)
  - Fire transport events for assigned bus only
  - Access Denied: Other buses (BUS_018, BUS_007), other domains

### 4. **LAUNDRY_ADMIN** 🧺
- **User**: Priya Nair
- **Assigned Block**: Block A (HOSTEL-A, GRP004 - 45 students)
- **Access Level**: Laundry domain + assigned block only
- **Capabilities**:
  - View only assigned block (Block A)
  - Fire laundry events for 3 machines in Block A
  - Access Denied: Other blocks, other domains

### 5. **MESS_ADMIN** 🍽️
- **User**: Suresh Babu
- **Assigned Mess**: Main Mess (GRP005 - 247 students)
- **Access Level**: Mess domain + assigned mess only
- **Capabilities**:
  - View check-ins, absences, refunds
  - Fire mess events (check-in, absence, refund)
  - Process refunds
  - Access Denied: Other messes, other domains

### 6. **STUDENT** 🎓
- **User**: John Doe (CS2021045)
- **Access Level**: Read-only, notifications only
- **Capabilities**:
  - View own profile
  - View notifications for subscribed groups
  - Subscribe/unsubscribe from groups
  - View own groups and subscriptions
  - Access Denied: All POST/PUT/DELETE operations, viewing other users

---

## 🔐 Route Authorization Matrix

### `/api/auth` - Authentication Routes
```
POST /auth/login
  ✓ All roles (unauthenticated)

POST /auth/logout
  ✓ All authenticated roles

POST /auth/refresh
  ✓ All authenticated roles
```

### `/api/students` - Student Profile Routes
```
GET /students/:id
  ✓ SUPER_ADMIN (any student)
  ✓ TEACHER, BUS_ADMIN, LAUNDRY_ADMIN, MESS_ADMIN (any student)
  ✓ STUDENT (own profile only)

PUT /students/:id
  ✓ SUPER_ADMIN (any student)
  ✓ STUDENT (own profile only)

PUT /students/:id/fcm-token
  ✓ SUPER_ADMIN (any student)
  ✓ STUDENT (own token only)

GET /students/:id/groups
  ✓ SUPER_ADMIN (any student's groups)
  ✓ Domain Admins (any student's groups)
  ✓ STUDENT (own groups only)

GET /students/:id/notifications
  ✓ STUDENT (own notifications only)
```

### `/api/groups` - Group Management Routes
```
GET /groups
  ✓ SUPER_ADMIN → all groups
  ✓ TEACHER → GRP001, GRP002 (assigned)
  ✓ BUS_ADMIN → GRP003 (assigned)
  ✓ LAUNDRY_ADMIN → GRP004 (assigned)
  ✓ MESS_ADMIN → GRP005 (assigned)
  ✓ STUDENT → groups they belong to

POST /groups
  ✓ SUPER_ADMIN only

GET /groups/:id
  ✓ SUPER_ADMIN (any group)
  ✓ Relevant domain admin (assigned group)
  ✓ STUDENT (groups they belong to)

PUT /groups/:id
  ✓ SUPER_ADMIN only

DELETE /groups/:id
  ✓ SUPER_ADMIN only

GET /groups/:id/members
  ✓ SUPER_ADMIN (any group members)
  ✓ Relevant domain admin (assigned group members)
  ✓ STUDENT (own group members)

POST /groups/:id/members
  ✓ SUPER_ADMIN only

DELETE /groups/:id/members/:studentId
  ✓ SUPER_ADMIN only
```

### `/api/subscriptions` - Subscription Routes
```
POST /subscriptions
  ✓ STUDENT (own subscriptions)
  ✓ All admins (any student)

DELETE /subscriptions/:id
  ✓ STUDENT (own subscriptions)
  ✓ All admins (any subscription)

GET /subscriptions/student/:studentId
  ✓ STUDENT (own subscriptions)
  ✓ All admins (any student's subscriptions)

GET /subscriptions/group/:groupId
  ✓ SUPER_ADMIN (any group subscribers)
  ✓ Relevant domain admin (assigned group subscribers)
  ✗ STUDENT (denied)
```

### `/api/academics` - Academic Domain Routes
```
GET /academics
  ✓ TEACHER (assigned courses: GRP001, GRP002)
  ✓ SUPER_ADMIN (all academic groups)

POST /academics/event
  ✓ TEACHER (GRP001, GRP002 only)
  ✓ SUPER_ADMIN (any group)
  Valid event types: CLASS_CANCELLED, CLASS_RESCHEDULED, EXAM_POSTPONED

GET /academics/:id
  ✓ TEACHER (assigned groups only)
  ✓ SUPER_ADMIN (any group)

PUT /academics/:id
  ✓ SUPER_ADMIN only

DELETE /academics/:id
  ✓ SUPER_ADMIN only

✗ BUS_ADMIN → 403 Forbidden
✗ LAUNDRY_ADMIN → 403 Forbidden
✗ MESS_ADMIN → 403 Forbidden
✗ STUDENT → 403 Forbidden (except read own groups)
```

### `/api/transport` - Transport Domain Routes
```
GET /transport
  ✓ BUS_ADMIN (BUS_052 only)
  ✓ SUPER_ADMIN (all buses)

POST /transport/event
  ✓ BUS_ADMIN (BUS_052 only)
  ✓ SUPER_ADMIN (any bus)
  Valid event types: BUS_DELAYED, BUS_CANCELLED, BUS_ARRIVED
  Denied buses: BUS_018, BUS_007

GET /transport/:id
  ✓ BUS_ADMIN (BUS_052 only)
  ✓ SUPER_ADMIN (any bus)

PUT /transport/:id
  ✓ BUS_ADMIN (BUS_052 only)
  ✓ SUPER_ADMIN (any bus)

DELETE /transport/:id
  ✓ SUPER_ADMIN only

✗ TEACHER → 403 Forbidden
✗ LAUNDRY_ADMIN → 403 Forbidden
✗ MESS_ADMIN → 403 Forbidden
✗ STUDENT → 403 Forbidden
```

### `/api/laundry` - Laundry Domain Routes
```
GET /laundry
  ✓ LAUNDRY_ADMIN (Block A only: HOSTEL-A)
  ✓ SUPER_ADMIN (all blocks)

POST /laundry/event
  ✓ LAUNDRY_ADMIN (Block A only)
  ✓ SUPER_ADMIN (any block)
  Valid event types: WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, WASH_MACHINE_STARTED, WASH_SLOT_BOOKED

GET /laundry/:id
  ✓ LAUNDRY_ADMIN (Block A only)
  ✓ SUPER_ADMIN (any block)

PUT /laundry/:id
  ✓ LAUNDRY_ADMIN (Block A only)
  ✓ SUPER_ADMIN (any block)

DELETE /laundry/:id
  ✓ SUPER_ADMIN only

✗ TEACHER → 403 Forbidden
✗ BUS_ADMIN → 403 Forbidden
✗ MESS_ADMIN → 403 Forbidden
✗ STUDENT → 403 Forbidden
```

### `/api/mess` - Mess Domain Routes
```
GET /mess
  ✓ MESS_ADMIN (Main Mess only)
  ✓ SUPER_ADMIN (all messes)

POST /mess/event
  ✓ MESS_ADMIN (Main Mess only)
  ✓ SUPER_ADMIN (any mess)
  Valid event types: MESS_CHECKIN, MESS_ABSENT, MESS_REFUND_REQUESTED, MESS_REFUND_PROCESSED

GET /mess/:id
  ✓ MESS_ADMIN (Main Mess only)
  ✓ SUPER_ADMIN (any mess)

PUT /mess/:id
  ✓ MESS_ADMIN (Main Mess only)
  ✓ SUPER_ADMIN (any mess)

DELETE /mess/:id
  ✓ SUPER_ADMIN only

GET /mess/checkins/:date
  ✓ MESS_ADMIN
  ✓ SUPER_ADMIN

POST /mess/refund
  ✓ MESS_ADMIN
  ✓ SUPER_ADMIN

✗ TEACHER → 403 Forbidden
✗ BUS_ADMIN → 403 Forbidden
✗ LAUNDRY_ADMIN → 403 Forbidden
✗ STUDENT → 403 Forbidden
```

### `/api/events` - Unified Event Firing Routes
```
POST /events
  ✓ TEACHER (domain: academics, types: CLASS_*)
  ✓ BUS_ADMIN (domain: transport, busId: BUS_052)
  ✓ LAUNDRY_ADMIN (domain: laundry, blockId: HOSTEL-A)
  ✓ MESS_ADMIN (domain: mess, messId: MAIN_MESS)
  ✓ SUPER_ADMIN (any domain, any entity)

GET /events
  ✓ TEACHER (academic events + subscribed groups)
  ✓ BUS_ADMIN (transport events + subscribed)
  ✓ LAUNDRY_ADMIN (laundry events + subscribed)
  ✓ MESS_ADMIN (mess events + subscribed)
  ✓ STUDENT (subscribed notifications only)
  ✓ SUPER_ADMIN (all events)

GET /events/:id
  ✓ Event creator/owner
  ✓ SUPER_ADMIN
  ✓ Relevant domain admin

GET /events/domain/:domain
  ✓ Relevant domain admin (assigned domain only)
  ✓ SUPER_ADMIN (any domain)
  ✗ STUDENT (denied - use subscriptions)

GET /events/queue/status
  ✓ SUPER_ADMIN only
```

---

## 🔑 Middleware Functions

### `verifyToken`
Authenticates JWT token and attaches user info to `req.user`:
```javascript
{
  id: userId,
  role: userRole,
  username: username,
  name: fullName,
  groups: assignedGroups
}
```

### `allowRoles(...roles)`
Allows specific roles only:
```javascript
allowRoles('SUPER_ADMIN', 'TEACHER') // Only these 2 roles
```

### `allowRolesWithSuper(...roles)`
Allows specific roles + SUPER_ADMIN automatically:
```javascript
allowRolesWithSuper('TEACHER', 'BUS_ADMIN') // Allows TEACHER, BUS_ADMIN, SUPER_ADMIN
```

---

## 📊 Domain-to-Role Mapping

| Domain | Primary Role | Assigned Entity | Members | Event Types |
|--------|--------------|-----------------|---------|------------|
| academics | TEACHER | GRP001, GRP002 | 62, 55 | CLASS_* |
| transport | BUS_ADMIN | BUS_052 (GRP003) | 34 | BUS_* |
| laundry | LAUNDRY_ADMIN | HOSTEL-A (GRP004) | 45 | WASH_* |
| mess | MESS_ADMIN | MAIN_MESS (GRP005) | 247 | MESS_* |

---

## 🚫 Access Denied Scenarios

### TEACHER cannot:
- Fire transport, laundry, mess events
- View buses, laundry, mess data
- Access groups outside GRP001, GRP002
- Create/modify any groups

### BUS_ADMIN cannot:
- Fire academic, laundry, mess events
- Access other buses
- View courses, laundry, mess data
- Fire events for BUS_018 or BUS_007

### LAUNDRY_ADMIN cannot:
- Fire academic, transport, mess events
- Access other blocks
- View courses, buses, mess data
- Create/modify groups

### MESS_ADMIN cannot:
- Fire academic, transport, laundry events
- Access other messes
- View courses, buses, laundry data
- Create/modify groups

### STUDENT cannot:
- Fire ANY events
- Modify own profile (except FCM token update)
- Access other student profiles
- View domain events directly
- Manage groups
- Access admin dashboards

---

## 📝 Error Responses

All endpoints return standardized error responses:

```json
{
  "message": "Unauthorized access - insufficient permissions"
}
```

HTTP Status Codes:
- `200`: Success
- `400`: Bad request (invalid data)
- `401`: Unauthorized (no/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Server error

---

## 🔄 Event Processing Flow

```
User (Domain Admin) fires event
  ↓
POST /api/events
  ↓
RBAC validation (role + entity check)
  ↓
Event queued in BullMQ
  ↓
Worker processes event
  ↓
Notifications sent to subscribed students
  ↓
Delivery status updated
```

---

## ⚡ Special Cases

### SUPER_ADMIN Behavior
- Can see **all** groups and users
- Can fire events in **any** domain
- Has access to **queue status**
- Can create/modify/delete **all** records

### STUDENT Behavior
- **Read-only** on own data
- **Notifications** are automatically subscribed based on groups
- **Cannot** modify any data except FCM token
- **Cannot** access admin routes

### Domain Admin Scoping
All domain admins (TEACHER, BUS_ADMIN, LAUNDRY_ADMIN, MESS_ADMIN):
- Can only see their **assigned** entity
- Can fire events **only** for assigned entity
- Can view group members **only** for assigned group
- **Cannot** cross-domain access

---

## 📖 Usage Examples

### Example 1: Teacher firing academic event
```bash
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "domain": "academics",
  "type": "CLASS_CANCELLED",
  "groupId": "GRP001",
  "reason": "Personal leave"
}

# ✓ Success - notifies 62 students in CS101
```

### Example 2: Student viewing notifications
```bash
GET /api/students/STU001/notifications
Authorization: Bearer <token>

# ✓ Returns: 4 notifications (BUS delay, class cancel, laundry done, mess checkin)
```

### Example 3: BUS_ADMIN accessing wrong bus
```bash
GET /api/transport/BUS_018
Authorization: Bearer <token>

# ✗ Error 403: BUS_ADMIN can only access assigned bus (BUS_052)
```

---

## ✅ Implementation Summary

- ✅ 6 roles with distinct permissions
- ✅ Entity-level RBAC (admins access their entity only)
- ✅ Domain isolation (cross-domain access blocked)
- ✅ Event firing with role validation
- ✅ Group-based access control
- ✅ Student read-only permission model
- ✅ Standardized middleware functions
- ✅ Comprehensive error handling

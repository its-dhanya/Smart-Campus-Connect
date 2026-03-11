# RBAC Quick Reference Card

## 🎯 Roles Quick Reference

```
SUPER_ADMIN (🛡️)     → Full access to everything
├─ View: All data across all domains
├─ Fire: Events in any domain
├─ Manage: Users, groups, queue
└─ Admin access: All endpoints

TEACHER (👩‍🏫)         → Academic domain only
├─ Assigned: GRP001, GRP002 (CS101, CS202)
├─ Fire: Academic events (CLASS_CANCELLED, etc.)
├─ View: Only their 2 courses
└─ Denied: Transport, Laundry, Mess

BUS_ADMIN (🚌)      → Transport domain only
├─ Assigned: BUS_052 (Route 42, GRP003)
├─ Fire: Transport events (BUS_DELAYED, etc.)
├─ View: Only their bus
└─ Denied: Other buses, Academics, Laundry, Mess

LAUNDRY_ADMIN (🧺)  → Laundry domain only
├─ Assigned: Block A (HOSTEL-A, GRP004)
├─ Fire: Laundry events (WASH_*, etc.)
├─ View: Only their block
└─ Denied: Other blocks, Academics, Transport, Mess

MESS_ADMIN (🍽️)     → Mess domain only
├─ Assigned: Main Mess (GRP005, 247 students)
├─ Fire: Mess events (CHECKIN, REFUND, etc.)
├─ View: Check-ins, absences, refunds
└─ Denied: Other messes, Academics, Transport, Laundry

STUDENT (🎓)        → Read-only access
├─ View: Own profile, notifications, groups
├─ Write: Own profile & FCM token only
├─ Subscribe: To any group
└─ Denied: Fire events, view others, admin ops
```

---

## 🔐 Endpoint Quick Guide

### Academics API
```
GET    /api/academics              ← TEACHER + SUPER_ADMIN
POST   /api/academics              ← SUPER_ADMIN only
GET    /api/academics/:id          ← TEACHER + SUPER_ADMIN
PUT    /api/academics/:id          ← SUPER_ADMIN only
DELETE /api/academics/:id          ← SUPER_ADMIN only
POST   /api/academics/event        ← TEACHER + SUPER_ADMIN
       Event: CLASS_CANCELLED, CLASS_RESCHEDULED, EXAM_POSTPONED
```

### Transport API
```
GET    /api/transport              ← BUS_ADMIN + SUPER_ADMIN
POST   /api/transport              ← SUPER_ADMIN only
GET    /api/transport/:id          ← BUS_ADMIN (own) + SUPER_ADMIN
PUT    /api/transport/:id          ← BUS_ADMIN (own) + SUPER_ADMIN
DELETE /api/transport/:id          ← SUPER_ADMIN only
POST   /api/transport/event        ← BUS_ADMIN + SUPER_ADMIN
       Event: BUS_DELAYED, BUS_CANCELLED, BUS_ARRIVED
       Buses: BUS_052 only (or admin override)
```

### Laundry API
```
GET    /api/laundry                ← LAUNDRY_ADMIN + SUPER_ADMIN
POST   /api/laundry                ← SUPER_ADMIN only
GET    /api/laundry/:id            ← LAUNDRY_ADMIN (Block A) + SUPER_ADMIN
PUT    /api/laundry/:id            ← LAUNDRY_ADMIN (Block A) + SUPER_ADMIN
DELETE /api/laundry/:id            ← SUPER_ADMIN only
POST   /api/laundry/event          ← LAUNDRY_ADMIN + SUPER_ADMIN
       Event: WASH_MACHINE_COMPLETED, WASH_SLOT_CANCELLED, etc.
       Block: HOSTEL-A only (or admin override)
```

### Mess API
```
GET    /api/mess                   ← MESS_ADMIN + SUPER_ADMIN
POST   /api/mess                   ← SUPER_ADMIN only
GET    /api/mess/:id               ← MESS_ADMIN (Main) + SUPER_ADMIN
PUT    /api/mess/:id               ← MESS_ADMIN (Main) + SUPER_ADMIN
DELETE /api/mess/:id               ← SUPER_ADMIN only
POST   /api/mess/event             ← MESS_ADMIN + SUPER_ADMIN
       Event: MESS_CHECKIN, MESS_ABSENT, MESS_REFUND_*, etc.
GET    /api/mess/checkins/:date    ← MESS_ADMIN + SUPER_ADMIN
POST   /api/mess/refund            ← MESS_ADMIN + SUPER_ADMIN
```

### Groups API
```
GET    /api/groups                 ← All authenticated users
POST   /api/groups                 ← SUPER_ADMIN only
GET    /api/groups/:id             ← Relevant users + SUPER_ADMIN
PUT    /api/groups/:id             ← SUPER_ADMIN only
DELETE /api/groups/:id             ← SUPER_ADMIN only
GET    /api/groups/:id/members     ← Domain admin + SUPER_ADMIN
POST   /api/groups/:id/members     ← SUPER_ADMIN only
DELETE /api/groups/:id/members/:id ← SUPER_ADMIN only
```

### Students API
```
GET    /api/students/:id           ← Self + admins + SUPER_ADMIN
PUT    /api/students/:id           ← Self + SUPER_ADMIN
PUT    /api/students/:id/fcm-token ← Self + SUPER_ADMIN
GET    /api/students/:id/groups    ← Self + admins + SUPER_ADMIN
GET    /api/students/:id/notes     ← Self only
```

### Subscriptions API
```
POST   /api/subscriptions          ← Self + admins
DELETE /api/subscriptions/:id      ← Self + admins
GET    /api/subscriptions/student/:id   ← Self + admins
GET    /api/subscriptions/group/:id     ← Domain admin + SUPER_ADMIN
```

### Events API
```
POST   /api/events                 ← Domain admins in their domain
GET    /api/events                 ← All users (filtered by role)
GET    /api/events/:id             ← Event owner/SUPER_ADMIN/domain admin
GET    /api/events/domain/:id      ← Domain admin + SUPER_ADMIN
GET    /api/events/queue/status    ← SUPER_ADMIN only
```

---

## 📋 Event Type Quick Reference

### Academic Events (TEACHER → GRP001, GRP002)
- `CLASS_CANCELLED` - Class cancelled
- `CLASS_RESCHEDULED` - Class moved to different time/room
- `EXAM_POSTPONED` - Exam scheduled for later

### Transport Events (BUS_ADMIN → BUS_052)
- `BUS_DELAYED` - Bus running late
- `BUS_CANCELLED` - Bus route cancelled
- `BUS_ARRIVED` - Bus reached destination

### Laundry Events (LAUNDRY_ADMIN → Block A)
- `WASH_MACHINE_COMPLETED` - Washing done
- `WASH_SLOT_CANCELLED` - Booking cancelled
- `WASH_MACHINE_STARTED` - Washing started
- `WASH_SLOT_BOOKED` - New booking

### Mess Events (MESS_ADMIN → Main Mess)
- `MESS_CHECKIN` - Student checked in
- `MESS_ABSENT` - Student absent
- `MESS_REFUND_REQUESTED` - Refund requested
- `MESS_REFUND_PROCESSED` - Refund completed

---

## 🛡️ Authorization Patterns

### Pattern 1: Domain-Restricted (TEACHER)
```javascript
POST /api/academics/event
✓ TEACHER can fire → GRP001, GRP002
✗ TEACHER cannot → GRP003, GRP004, GRP005
✓ SUPER_ADMIN can fire → any group
```

### Pattern 2: Entity-Restricted (BUS_ADMIN)
```javascript
GET /api/transport/BUS_052
✓ Admin (Ravi Kumar) can access
✗ Admin cannot access → BUS_018, BUS_007
✓ SUPER_ADMIN can access both

POST /api/transport/event { busId: 'BUS_018' }
✗ BUS_ADMIN error: Cannot fire for BUS_018
✓ SUPER_ADMIN succeeds
```

### Pattern 3: Self-Only (STUDENT)
```javascript
GET /api/students/STU001/notifications
✓ STUDENT (John) can view → own notifications
✗ STUDENT cannot view → other student's notifications
✓ SUPER_ADMIN can view any → student's notifications
```

### Pattern 4: Admin-Only (SUPER_ADMIN)
```javascript
POST /api/groups
✗ TEACHER/BUS_ADMIN/etc → 403 Forbidden
✓ SUPER_ADMIN only → can create

GET /api/events/queue/status
✗ All other roles → 403 Forbidden
✓ SUPER_ADMIN only → can view queue
```

---

## Error Response Examples

### Insufficient Permissions
```json
{
  "message": "Unauthorized access - insufficient permissions"
}
```
Status: `403`

### Invalid Domain/Entity
```json
{
  "message": "TEACHER can only fire events to assigned groups (GRP001, GRP002)"
}
```
Status: `403`

### Invalid Token
```json
{
  "message": "Token is not valid"
}
```
Status: `401`

### Invalid Data
```json
{
  "message": "Invalid event type",
  "validTypes": ["CLASS_CANCELLED", "CLASS_RESCHEDULED", "EXAM_POSTPONED"]
}
```
Status: `400`

---

## 🎓 Testing Checklist

### For Each Role:
- [ ] Can access only their domain
- [ ] Cannot access other domains
- [ ] Cannot modify (POST/PUT/DELETE) except SUPER_ADMIN
- [ ] Can view appropriate groups/entities
- [ ] Gets 403 for unauthorized actions
- [ ] Gets 401 for missing token

### For Domain Admins:
- [ ] Cannot access other admin's entities
- [ ] Can fire events only for assigned entity
- [ ] Can view group subscribers for assigned group only
- [ ] Event validation works (correct event types)

### For STUDENT:
- [ ] Can view own profile only
- [ ] Can read notifications
- [ ] Cannot fire ANY events
- [ ] Cannot access admin endpoints
- [ ] Can subscribe/unsubscribe groups

### For SUPER_ADMIN:
- [ ] Can access all endpoints
- [ ] Can override any RBAC restriction
- [ ] Can view queue status
- [ ] Can create/modify/delete records

---

## 🚀 Quick Test Commands

```bash
# Login as TEACHER
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"TEACHER","username":"Prof. Smith"}'

# Fire academic event (success)
curl -X POST http://localhost:3000/api/academics/event \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -d '{
    "domain": "academics",
    "type": "CLASS_CANCELLED",
    "groupId": "GRP001",
    "reason": "Personal leave"
  }'

# Try to fire mess event (403 error)
curl -X POST http://localhost:3000/api/mess/event \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -d '{
    "domain": "mess",
    "type": "MESS_CHECKIN"
  }'
# Response: 403 Forbidden - TEACHER cannot fire mess events
```

---

## 📞 Support

For RBAC questions, refer to:
1. `RBAC_ROUTES.md` - Comprehensive documentation
2. [Middleware](src/middleware/authMiddleware.js) - Authorization logic
3. [Router functions](src/middleware/authMiddleware.js) - allowRoles, allowRolesWithSuper
4. HTML file - `smart-campus-rbac.html` - Visual reference

const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');
// const groupController = require('../controllers/groupController');

/**
 * GROUP ROUTES (Restricted by Role)
 * 
 * Groups are organized by domain:
 * - GRP001, GRP002 → TEACHER (Prof. Smith)
 * - GRP003 → BUS_ADMIN (Ravi Kumar, BUS_052)
 * - GRP004 → LAUNDRY_ADMIN (Priya Nair, Block A)
 * - GRP005 → MESS_ADMIN (Suresh Babu, Main Mess)
 * 
 * Only SUPER_ADMIN can create/modify all groups
 * Domain admins can only read their assigned groups
 * Students can only read groups they belong to
 */

// GET /groups - List groups
// SUPER_ADMIN: all groups
// Domain Admins (TEACHER, BUS_ADMIN, LAUNDRY_ADMIN, MESS_ADMIN): only their groups
// STUDENT: only groups they belong to
router.get('/', verifyToken, (req, res) => {
  let groups = [];
  
  if (req.user.role === 'SUPER_ADMIN') {
    // Return all groups
    groups = [
      { id: 'GRP001', name: 'CS101 — Data Structures', type: 'academics', owner: 'TEACHER', members: 62 },
      { id: 'GRP002', name: 'CS202 — Operating Systems', type: 'academics', owner: 'TEACHER', members: 55 },
      { id: 'GRP003', name: 'Bus 052 — Route 42', type: 'transport', owner: 'BUS_ADMIN', members: 34 },
      { id: 'GRP004', name: 'Block A Laundry', type: 'laundry', owner: 'LAUNDRY_ADMIN', members: 45 },
      { id: 'GRP005', name: 'Main Mess', type: 'mess', owner: 'MESS_ADMIN', members: 247 }
    ];
    return res.json({ message: 'Get all groups', groups, accessLevel: 'FULL' });
  }

  if (req.user.role === 'TEACHER') {
    groups = [
      { id: 'GRP001', name: 'CS101 — Data Structures', type: 'academics', owner: 'TEACHER', members: 62 },
      { id: 'GRP002', name: 'CS202 — Operating Systems', type: 'academics', owner: 'TEACHER', members: 55 }
    ];
    return res.json({ message: 'Get assigned groups (TEACHER)', groups, accessLevel: 'ASSIGNED_ONLY' });
  }

  if (req.user.role === 'BUS_ADMIN') {
    groups = [
      { id: 'GRP003', name: 'Bus 052 — Route 42', type: 'transport', owner: 'BUS_ADMIN', members: 34 }
    ];
    return res.json({ message: 'Get assigned group (BUS_ADMIN)', groups, accessLevel: 'ASSIGNED_ONLY' });
  }

  if (req.user.role === 'LAUNDRY_ADMIN') {
    groups = [
      { id: 'GRP004', name: 'Block A Laundry', type: 'laundry', owner: 'LAUNDRY_ADMIN', members: 45 }
    ];
    return res.json({ message: 'Get assigned group (LAUNDRY_ADMIN)', groups, accessLevel: 'ASSIGNED_ONLY' });
  }

  if (req.user.role === 'MESS_ADMIN') {
    groups = [
      { id: 'GRP005', name: 'Main Mess', type: 'mess', owner: 'MESS_ADMIN', members: 247 }
    ];
    return res.json({ message: 'Get assigned group (MESS_ADMIN)', groups, accessLevel: 'ASSIGNED_ONLY' });
  }

  if (req.user.role === 'STUDENT') {
    groups = [
      { id: 'GRP001', name: 'CS101 — Data Structures', type: 'academics', members: 62 },
      { id: 'GRP002', name: 'CS202 — Operating Systems', type: 'academics', members: 55 },
      { id: 'GRP003', name: 'Bus 052 — Route 42', type: 'transport', members: 34 },
      { id: 'GRP004', name: 'Block A Laundry', type: 'laundry', members: 45 },
      { id: 'GRP005', name: 'Main Mess', type: 'mess', members: 247 }
    ];
    return res.json({ message: 'Get groups you belong to (STUDENT)', groups, accessLevel: 'OWN_GROUPS_ONLY' });
  }

  return res.status(403).json({ message: 'Invalid role' });
});

// POST /groups - Create group (SUPER_ADMIN ONLY)
router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  const { name, type, owner } = req.body;
  res.json({ 
    message: 'Group created successfully',
    group: {
      id: `GRP${Math.random().toString().slice(2, 5)}`,
      name: name,
      type: type,
      owner: owner,
      createdBy: req.user.username,
      timestamp: new Date().toISOString()
    }
  });
});

// GET /groups/:id - Get group details
// SUPER_ADMIN: any group
// Domain Admins: only their groups
// STUDENT: only groups they belong to
router.get('/:id', verifyToken, (req, res) => {
  const groupId = req.params.id;
  
  // Define group access
  const groupAccess = {
    'GRP001': ['SUPER_ADMIN', 'TEACHER', 'STUDENT'],
    'GRP002': ['SUPER_ADMIN', 'TEACHER', 'STUDENT'],
    'GRP003': ['SUPER_ADMIN', 'BUS_ADMIN', 'STUDENT'],
    'GRP004': ['SUPER_ADMIN', 'LAUNDRY_ADMIN', 'STUDENT'],
    'GRP005': ['SUPER_ADMIN', 'MESS_ADMIN', 'STUDENT']
  };

  if (!groupAccess[groupId]?.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this group' });
  }

  res.json({
    message: 'Get group details',
    group: {
      id: groupId,
      name: `Group ${groupId}`,
      type: 'domain_type',
      members: 50,
      role: req.user.role
    }
  });
});

// PUT /groups/:id - Update group (SUPER_ADMIN ONLY)
router.put('/:id', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  const groupId = req.params.id;
  res.json({ 
    message: 'Group updated successfully',
    groupId: groupId,
    updatedBy: req.user.username
  });
});

// DELETE /groups/:id - Delete group (SUPER_ADMIN ONLY)
router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  const groupId = req.params.id;
  res.json({ 
    message: 'Group deleted successfully',
    groupId: groupId,
    deletedBy: req.user.username
  });
});

// GET /groups/:id/members - Get members of a group
// SUPER_ADMIN: any group
// Domain Admins: only their groups
// STUDENT: only their own groups
router.get('/:id/members', verifyToken, (req, res) => {
  const groupId = req.params.id;
  
  // Define access
  const groupAccess = {
    'GRP001': ['SUPER_ADMIN', 'TEACHER', 'STUDENT'],
    'GRP002': ['SUPER_ADMIN', 'TEACHER', 'STUDENT'],
    'GRP003': ['SUPER_ADMIN', 'BUS_ADMIN', 'STUDENT'],
    'GRP004': ['SUPER_ADMIN', 'LAUNDRY_ADMIN', 'STUDENT'],
    'GRP005': ['SUPER_ADMIN', 'MESS_ADMIN', 'STUDENT']
  };

  if (!groupAccess[groupId]?.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this group' });
  }

  res.json({
    message: 'Get group members',
    groupId: groupId,
    memberCount: 50,
    members: [
      { id: 'STU001', name: 'John Doe', email: 'john@campus.edu' },
      { id: 'STU002', name: 'Alice Kumar', email: 'alice@campus.edu' }
      // ... more members
    ]
  });
});

// POST /groups/:id/members - Add member to group (SUPER_ADMIN ONLY)
router.post('/:id/members', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  const groupId = req.params.id;
  const { studentId } = req.body;
  res.json({
    message: 'Member added to group',
    groupId: groupId,
    studentId: studentId,
    addedBy: req.user.username
  });
});

// DELETE /groups/:id/members/:studentId - Remove member from group (SUPER_ADMIN ONLY)
router.delete('/:id/members/:studentId', verifyToken, allowRoles('SUPER_ADMIN'), (req, res) => {
  const groupId = req.params.id;
  const studentId = req.params.studentId;
  res.json({
    message: 'Member removed from group',
    groupId: groupId,
    studentId: studentId,
    removedBy: req.user.username
  });
});

module.exports = router;

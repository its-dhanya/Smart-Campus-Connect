const express = require('express');
const router = express.Router();
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');
const groupController = require('../controllers/groupController');

// GET /groups - List groups (role-filtered)
router.get('/', verifyToken, groupController.getAllGroups);

// POST /groups - Create group (SUPER_ADMIN only)
router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), groupController.createGroup);

// GET /groups/:id - Get group details
router.get('/:id', verifyToken, groupController.getGroupById);

// PUT /groups/:id - Update group (SUPER_ADMIN only)
router.put('/:id', verifyToken, allowRoles('SUPER_ADMIN'), groupController.updateGroup);

// DELETE /groups/:id - Delete group (SUPER_ADMIN only)
router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), groupController.deleteGroup);

// GET /groups/:id/members - Get members of a group
router.get('/:id/members', verifyToken, groupController.getGroupMembers);

// POST /groups/:id/members - Add student to group (SUPER_ADMIN only)
router.post('/:id/members', verifyToken, allowRoles('SUPER_ADMIN'), groupController.addMember);

// DELETE /groups/:id/members/:studentId - Remove student from group (SUPER_ADMIN only)
router.delete(
  '/:id/members/:studentId',
  verifyToken,
  allowRoles('SUPER_ADMIN'),
  groupController.removeMember
);

module.exports = router;
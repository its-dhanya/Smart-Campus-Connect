const express = require('express');
const router = express.Router();
const { verifyToken, allowRolesWithSuper, allowRoles } = require('../middleware/authMiddleware');
const academicController = require('../controllers/academicController');

/**
 * ACADEMIC ROUTES (TEACHER + SUPER_ADMIN)
 * Teachers can only access/read their assigned courses (GRP001, GRP002)
 * Teachers can fire academic events to their groups
 */

// GET /academics - List academic groups (TEACHER + SUPER_ADMIN)
router.get('/', verifyToken, allowRolesWithSuper('TEACHER'), academicController.getAllAcademicGroups);

// POST /academics - Create academic group (SUPER_ADMIN only)
router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), academicController.createAcademicGroup);

// POST /academics/event - Fire academic event  ← MUST be before /:id
router.post('/event', verifyToken, allowRolesWithSuper('TEACHER'), academicController.fireAcademicEvent);

// GET /academics/events/:groupId - Recent events for a course  ← MUST be before /:id
router.get('/events/:groupId', verifyToken, allowRolesWithSuper('TEACHER'), academicController.getRecentAcademicEvents);

// GET /academics/:id - Get specific academic group details
router.get('/:id', verifyToken, allowRolesWithSuper('TEACHER'), academicController.getAcademicGroupById);

// PUT /academics/:id - Update academic group (SUPER_ADMIN only)
router.put('/:id', verifyToken, allowRoles('SUPER_ADMIN'), academicController.updateAcademicGroup);

// DELETE /academics/:id - Delete academic group (SUPER_ADMIN only)
router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), academicController.deleteAcademicGroup);

module.exports = router;
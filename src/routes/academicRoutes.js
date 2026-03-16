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

router.post('/', verifyToken, allowRoles('SUPER_ADMIN'), academicController.createAcademicGroup);

// GET /academics/:id - Get specific academic group details (TEACHER + SUPER_ADMIN)
router.get('/:id', verifyToken, allowRolesWithSuper('TEACHER'), academicController.getAcademicGroupById);

router.put('/:id', verifyToken, allowRoles('SUPER_ADMIN'), academicController.updateAcademicGroup);

router.delete('/:id', verifyToken, allowRoles('SUPER_ADMIN'), academicController.deleteAcademicGroup);

// POST /academics/event - Fire academic event (TEACHER + SUPER_ADMIN)
router.post('/event', verifyToken, allowRolesWithSuper('TEACHER'), academicController.fireAcademicEvent);

// GET /academics/events/:groupId - Get recent academic events for a course (TEACHER + SUPER_ADMIN)
router.get('/events/:groupId', verifyToken, allowRolesWithSuper('TEACHER'), academicController.getRecentAcademicEvents);

module.exports = router;
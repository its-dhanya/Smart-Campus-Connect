const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /auth/register - Student registration
router.post('/register', authController.register);

// POST /auth/login - Student login
router.post('/login', authController.login);

// POST /auth/refresh - Refresh JWT token
router.post('/refresh', authController.refresh);

// POST /auth/logout - Logout
router.post('/logout', authController.logout);

module.exports = router;

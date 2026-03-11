const express = require('express');
const router = express.Router();
// const transportController = require('../controllers/transportController');

// GET /bus - List all bus routes
router.get('/', (req, res) => {
  res.json({ message: 'Get all buses' });
});

// POST /bus - Create bus route
router.post('/', (req, res) => {
  res.json({ message: 'Create bus route' });
});

// GET /bus/:id - Get specific bus details
router.get('/:id', (req, res) => {
  res.json({ message: 'Get bus details' });
});

// PUT /bus/:id - Update bus route
router.put('/:id', (req, res) => {
  res.json({ message: 'Update bus route' });
});

// DELETE /bus/:id - Delete bus route
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete bus route' });
});

module.exports = router;

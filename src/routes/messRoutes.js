const express = require('express');
const router = express.Router();
// const messController = require('../controllers/messController');

// GET /mess - List all mess groups
router.get('/', (req, res) => {
  res.json({ message: 'Get all mess groups' });
});

// POST /mess - Create mess group
router.post('/', (req, res) => {
  res.json({ message: 'Create mess group' });
});

// GET /mess/:id - Get specific mess group details
router.get('/:id', (req, res) => {
  res.json({ message: 'Get mess group details' });
});

// PUT /mess/:id - Update mess group
router.put('/:id', (req, res) => {
  res.json({ message: 'Update mess group' });
});

// DELETE /mess/:id - Delete mess group
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete mess group' });
});

module.exports = router;

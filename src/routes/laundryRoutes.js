const express = require('express');
const router = express.Router();
// const laundryController = require('../controllers/laundryController');

// GET /laundry - List all laundry groups
router.get('/', (req, res) => {
  res.json({ message: 'Get all laundry groups' });
});

// POST /laundry - Create laundry group
router.post('/', (req, res) => {
  res.json({ message: 'Create laundry group' });
});

// GET /laundry/:id - Get specific laundry group details
router.get('/:id', (req, res) => {
  res.json({ message: 'Get laundry group details' });
});

// PUT /laundry/:id - Update laundry group
router.put('/:id', (req, res) => {
  res.json({ message: 'Update laundry group' });
});

// DELETE /laundry/:id - Delete laundry group
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete laundry group' });
});

module.exports = router;

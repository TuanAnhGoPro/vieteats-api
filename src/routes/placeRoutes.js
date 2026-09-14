const express = require('express');
const auth = require('../middleware/auth');
const {
  getPlaces,
  getPlace,
  createPlace,
  updatePlace,
  deletePlace,
} = require('../controllers/placeController');

const router = express.Router();

// Public browsing
router.get('/', getPlaces);
router.get('/:id', getPlace);

// Adding/editing/deleting a place requires being logged in
router.post('/', auth, createPlace);
router.put('/:id', auth, updatePlace);
router.delete('/:id', auth, deletePlace);

module.exports = router;

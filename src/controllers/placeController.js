const Place = require('../models/Place');

// Public: list places, optional filters by city/category, newest first
async function getPlaces(req, res, next) {
  try {
    const filter = {};
    if (req.query.city) filter.city = req.query.city;
    if (req.query.category) filter.category = req.query.category;
    const places = await Place.find(filter).sort({ createdAt: -1 });
    return res.json(places);
  } catch (err) {
    return next(err);
  }
}

// Public: get a single place
async function getPlace(req, res, next) {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ message: 'Place not found' });
    return res.json(place);
  } catch (err) {
    return next(err);
  }
}

// Authenticated: add a new place
async function createPlace(req, res, next) {
  try {
    const { name, description, address, city, category, priceRange, rating } = req.body;
    if (!name || !address || !city) {
      return res.status(400).json({ message: 'name, address and city are required' });
    }
    const place = await Place.create({
      name,
      description,
      address,
      city,
      category,
      priceRange,
      rating,
      owner: req.userId,
    });
    return res.status(201).json(place);
  } catch (err) {
    return next(err);
  }
}

// Authenticated + owner only: update a place
async function updatePlace(req, res, next) {
  try {
    const place = await Place.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!place) return res.status(404).json({ message: 'Place not found' });
    return res.json(place);
  } catch (err) {
    return next(err);
  }
}

// Authenticated + owner only: delete a place
async function deletePlace(req, res, next) {
  try {
    const place = await Place.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!place) return res.status(404).json({ message: 'Place not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { getPlaces, getPlace, createPlace, updatePlace, deletePlace };

const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    address: { type: String, required: true, trim: true },
    city: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'Hanoi',
        'Ho Chi Minh City',
        'Da Nang',
        'Hoi An',
        'Hue',
        'Da Lat',
        'Nha Trang',
        'Can Tho',
        'Hai Phong',
        'Vung Tau',
        'Other',
      ],
    },
    category: {
      type: String,
      enum: ['cafe', 'restaurant', 'street-food', 'bar', 'dessert'],
      default: 'cafe',
    },
    priceRange: {
      type: String,
      enum: ['$', '$$', '$$$'],
      default: '$',
    },
    rating: { type: Number, min: 0, max: 5, default: 5 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

placeSchema.index({ city: 1, category: 1 });

module.exports = mongoose.model('Place', placeSchema);

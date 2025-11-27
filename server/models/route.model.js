const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  houses: [{
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
    },
    pickupStatus: {
      type: String,
      enum: ['pending', 'picked', 'not_picked'],
      default: 'pending',
    }
  }],
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;

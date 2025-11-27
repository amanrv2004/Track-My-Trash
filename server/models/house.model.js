const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  houseNo: {
    type: String,
    required: true,
  },
  block: {
    type: String,
    required: true,
  },
  sector: {
    type: String,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignmentDate: {
    type: Date,
  },
  assignmentExpiryDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

houseSchema.index({ location: '2dsphere' });

const House = mongoose.model('House', houseSchema);

module.exports = House;

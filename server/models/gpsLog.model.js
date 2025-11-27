const mongoose = require('mongoose');

const gpsLogSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

gpsLogSchema.index({ location: '2dsphere' });

const GpsLog = mongoose.model('GpsLog', gpsLogSchema);

module.exports = GpsLog;

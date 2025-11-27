const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  preferredTime: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'resolved', 'cancelled'],
    default: 'pending',
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

const EmergencyRequest = mongoose.model('EmergencyRequest', emergencyRequestSchema);

module.exports = EmergencyRequest;

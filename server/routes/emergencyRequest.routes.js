const express = require('express');
const router = express.Router();
const {
  getAllEmergencyRequests,
  updateEmergencyRequestStatus,
  createEmergencyRequest
} = require('../controllers/emergencyRequest.controller.js');
const { protect, admin } = require('../middleware/auth.middleware.js');

router.route('/').get(protect, admin, getAllEmergencyRequests).post(protect, createEmergencyRequest);
router.route('/:id').put(protect, admin, updateEmergencyRequestStatus);

module.exports = router;

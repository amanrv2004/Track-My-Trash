const express = require('express');
const router = express.Router();
const {
  getAssignedDriver,
  confirmPickup,
  fileComplaint,
  submitEmergencyRequest,
  getMyProfile,
  updateMyProfile,
  getMyHouseDetails, // New import
  getNearbyDrivers,   // New import
  getAssignedDriverLastLocation, // New import
} = require('../controllers/resident.controller.js');
const { protect, resident } = require('../middleware/auth.middleware.js');

router.get('/driver', protect, resident, getAssignedDriver);
router.post('/pickup/confirm', protect, resident, confirmPickup);
router.post('/complaint', protect, resident, fileComplaint);
router.post('/emergency-request', protect, resident, submitEmergencyRequest);
router.route('/profile').get(protect, resident, getMyProfile).put(protect, resident, updateMyProfile);

router.get('/house-details', protect, resident, getMyHouseDetails); // New route
router.get('/nearby-drivers', protect, resident, getNearbyDrivers); // New route
router.get('/assigned-driver-location', protect, resident, getAssignedDriverLastLocation); // New route

module.exports = router;

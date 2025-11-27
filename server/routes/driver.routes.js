const express = require('express');
const router = express.Router();
const {
  updateLocation,
  getMyRoute,
  markPickupStatus,
  stopSharingLocation, // New import
} = require('../controllers/driver.controller.js');
const { protect, driver } = require('../middleware/auth.middleware.js');

router.post('/location', protect, driver, updateLocation);
router.post('/stop-location', protect, driver, stopSharingLocation); // New route
router.get('/route', protect, driver, getMyRoute);
router.put('/pickup/:houseId', protect, driver, markPickupStatus);

module.exports = router;

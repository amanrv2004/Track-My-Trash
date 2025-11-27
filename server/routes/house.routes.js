const express = require('express');
const router = express.Router();
const { getAllHouses, getHousesWithDetails } = require('../controllers/house.controller.js');
const { protect, admin } = require('../middleware/auth.middleware.js');

router.route('/').get(protect, getAllHouses);
router.route('/with-details').get(protect, getHousesWithDetails);

module.exports = router;

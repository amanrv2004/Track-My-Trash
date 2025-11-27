const House = require('../models/house.model.js');

// @desc    Get all houses
// @route   GET /api/houses
// @access  Private/Admin
const getAllHouses = async (req, res) => {
  const houses = await House.find({}).populate('resident', 'name email');
  res.json(houses);
};

// @desc    Get all houses with populated resident and assignedDriver details
// @route   GET /api/houses/with-details
// @access  Private/Admin
const getHousesWithDetails = async (req, res) => {
  const houses = await House.find({})
    .populate('resident', 'name email')
    .populate('assignedDriver', 'name email vehicleNumber phone'); // Populate driver details

  res.json(houses);
};

module.exports = {
  getAllHouses,
  getHousesWithDetails,
};
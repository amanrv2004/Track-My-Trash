const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');
const House = require('../models/house.model.js');
const generateToken = require('../utils/generateToken.js');

// @desc    Register a new resident
// @route   POST /api/users/register/resident
// @access  Public
const registerResident = asyncHandler(async (req, res) => {
  const { name, email, password, houseNo, block, sector, location } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'resident',
  });

  if (user) {
    try {
      const house = await House.create({
        resident: user._id,
        houseNo,
        block,
        sector,
        location,
      });
      user.house = house._id;
      await user.save();

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSubscribed: user.isSubscribed, // Include isSubscribed in token payload
        token: generateToken(user._id, user.role, user.isSubscribed),
      });
    } catch (houseError) {
      // If house creation fails, delete the user to prevent orphan records
      await User.findByIdAndDelete(user._id);
      console.error('Error creating house, deleting user:', houseError);
      res.status(500);
      throw new Error('Failed to create house data.');
    }
  } else {
    res.status(400);
    throw new Error('Invalid resident data');
  }
});

// @desc    Register a new driver
// @route   POST /api/users/register/driver
// @access  Private/Admin
const registerDriver = asyncHandler(async (req, res) => {
  const { name, email, password, vehicleNumber, phone } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('Driver already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'driver',
    vehicleNumber,
    phone,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      vehicleNumber: user.vehicleNumber,
      phone: user.phone,
      token: generateToken(user._id, user.role), // Token should also include isSubscribed for residents if applicable
    });
  } else {
    res.status(400);
    throw new Error('Invalid driver data');
  }
});


// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    let userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSubscribed: user.isSubscribed, // Include isSubscribed in token payload
      token: generateToken(user._id, user.role, user.isSubscribed),
    };

    // If the user is a resident, populate their house details
    if (user.role === 'resident') {
      const residentUserWithHouse = await User.findById(user._id).populate('house');
      if (residentUserWithHouse && residentUserWithHouse.house) {
        userData.house = residentUserWithHouse.house;
      }
    }

    res.json(userData);
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

module.exports = {
  registerResident,
  registerDriver,
  authUser,
};

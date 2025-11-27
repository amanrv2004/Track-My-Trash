const House = require('../models/house.model.js');
const Complaint = require('../models/complaint.model.js');
const EmergencyRequest = require('../models/emergencyRequest.model.js');
const User = require('../models/user.model.js');
const GpsLog = require('../models/gpsLog.model.js'); // Import GpsLog model
const asyncHandler = require('express-async-handler'); // Import asyncHandler

// @desc    Get assigned driver details
// @route   GET /api/resident/driver
// @access  Private/Resident
const getAssignedDriver = asyncHandler(async (req, res) => {
  const house = await House.findOne({ resident: req.user._id }).populate('assignedDriver', 'name email vehicleNumber phone');
  if (house && house.assignedDriver) {
    res.json(house.assignedDriver);
  } else {
    res.status(404);
    throw new Error('No driver assigned');
  }
});

// @desc    Confirm garbage pickup
// @route   POST /api/resident/pickup/confirm
// @access  Private/Resident
const confirmPickup = asyncHandler(async (req, res) => {
  const residentId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the resident's house
  const house = await House.findOne({ resident: residentId });
  if (!house) {
    res.status(404);
    throw new Error('Resident house not found.');
  }

  // Find today's route for the assigned driver
  const route = await Route.findOne({
    driver: house.assignedDriver,
    date: { $gte: today },
  });

  if (route) {
    // Find the resident's house in the route and update its status
    const houseEntry = route.houses.find(h => h.house.toString() === house._id.toString());
    if (houseEntry) {
      houseEntry.pickupStatus = 'picked'; // Assuming resident confirming means it was picked
      await route.save();
      console.log(`Resident ${req.user.name} confirmed pickup for house ${house._id}.`);
      req.io.to('admin').emit('pickupConfirmed', { houseId: house._id, residentId: residentId, driverId: house.assignedDriver });
      res.json({ message: 'Pickup confirmed successfully!' });
      return;
    }
  }

  res.status(404);
  throw new Error('No pending pickup found to confirm for your house.');
});

// @desc    File a complaint
// @route   POST /api/resident/complaint
// @access  Private/Resident
const fileComplaint = asyncHandler(async (req, res) => {
  const { subject, description } = req.body;
  const complaint = await Complaint.create({
    resident: req.user._id,
    subject,
    description,
  });
  // Populate resident details before emitting
  const populatedComplaint = await Complaint.findById(complaint._id).populate('resident', 'name email');
  res.status(201).json(populatedComplaint);
  req.io.to('admin').emit('newComplaint', populatedComplaint);
});

// @desc    Submit an emergency pickup request
// @route   POST /api/resident/emergency-request
// @access  Private/Resident
const submitEmergencyRequest = asyncHandler(async (req, res) => {
  const { reason, preferredTime } = req.body;
  const request = await EmergencyRequest.create({
    resident: req.user._id,
    reason,
    preferredTime,
  });

  // Populate resident details before emitting
  const populatedRequest = await EmergencyRequest.findById(request._id).populate('resident', 'name email');

  req.io.to('admin').emit('emergencyRequest', populatedRequest);
  const house = await House.findOne({ resident: req.user._id });
  if (house && house.assignedDriver) {
    req.io.to(house.assignedDriver.toString()).emit('emergencyRequest', populatedRequest);
  }

  res.status(201).json(populatedRequest);
});

// @desc    Get my profile
// @route   GET /api/resident/profile
// @access  Private/Resident
const getMyProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password').populate('house');
    if(user){
        res.json(user)
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update my profile
// @route   PUT /api/resident/profile
// @access  Private/Resident
const updateMyProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) {
            user.password = req.body.password;
        }
        if (req.body.isSubscribed !== undefined) {
          user.isSubscribed = req.body.isSubscribed;
        }
        const updatedUser = await user.save();

        if(user.house && (req.body.houseNo || req.body.block || req.body.sector)) {
            const house = await House.findById(user.house);
            if(house){
                house.houseNo = req.body.houseNo || house.houseNo;
                house.block = req.body.block || house.block;
                house.sector = req.body.sector || house.sector;
                await house.save();
            }
        }

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            isSubscribed: updatedUser.isSubscribed,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get logged in resident's house details
// @route   GET /api/resident/house-details
// @access  Private/Resident
const getMyHouseDetails = asyncHandler(async (req, res) => {
  const house = await House.findOne({ resident: req.user._id });
  if (house) {
    res.json(house);
  } else {
    res.status(404);
    throw new Error('Resident house not found');
  }
});

// @desc    Get nearby drivers for the logged in resident
// @route   GET /api/resident/nearby-drivers
// @access  Private/Resident
const getNearbyDrivers = asyncHandler(async (req, res) => {
  const residentHouse = await House.findOne({ resident: req.user._id });

  if (!residentHouse || !residentHouse.location) {
    res.status(404);
    throw new Error('Resident house or location not found');
  }

  const { coordinates } = residentHouse.location;
  // MongoDB uses [longitude, latitude] for GeoJSON
  const longitude = coordinates[0];
  const latitude = coordinates[1];

  // Find drivers within a certain radius (e.g., 10 kilometers)
  // Distance is in meters, so 10km = 10000m
  const nearbyDrivers = await User.find({
    role: 'driver',
    'location.coordinates': {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: 10000, // 10 kilometers
      },
    },
  }).select('name email vehicleNumber location'); // Select relevant driver info

  res.json(nearbyDrivers);
});

// @desc    Get assigned driver's last known location
// @route   GET /api/resident/assigned-driver-location
// @access  Private/Resident
const getAssignedDriverLastLocation = asyncHandler(async (req, res) => {
  const residentId = req.user._id;
  console.log('--- Debugging getAssignedDriverLastLocation ---');
  console.log('Resident ID:', residentId);

  const house = await House.findOne({ resident: residentId });
  console.log('House found:', house);

  if (!house) {
    res.status(404);
    throw new Error('Resident house not found');
  }
  if (!house.assignedDriver) {
    console.log('No driver assigned to house.');
    res.status(404);
    throw new Error('No driver assigned to your house');
  }
  console.log('Assigned Driver ID (from house):', house.assignedDriver);

  const assignedDriverUser = await User.findById(house.assignedDriver);
  console.log('Assigned Driver User:', assignedDriverUser);

  if (!assignedDriverUser || !assignedDriverUser.isSharingLocation) {
    console.log('Assigned driver user not found or not sharing location.');
    res.status(404);
    throw new Error('Assigned driver is not currently sharing location');
  }
  console.log('Assigned Driver is sharing location:', assignedDriverUser.isSharingLocation);

  const latestGpsLog = await GpsLog.findOne({ driver: house.assignedDriver })
    .sort({ timestamp: -1 })
    .select('location');
  console.log('Latest GPS Log:', latestGpsLog);

  if (latestGpsLog) {
    res.json(latestGpsLog.location.coordinates); // Return [longitude, latitude]
  } else {
    console.log('Assigned driver location not found in GpsLog.');
    res.status(404);
    throw new Error('Assigned driver location not found');
  }
});


module.exports = {
  getAssignedDriver,
  confirmPickup,
  fileComplaint,
  submitEmergencyRequest,
  getMyProfile,
  updateMyProfile,
  getMyHouseDetails,
  getNearbyDrivers,
  getAssignedDriverLastLocation,
};

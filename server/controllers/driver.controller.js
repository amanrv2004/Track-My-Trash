const GpsLog = require('../models/gpsLog.model.js');
const Route = require('../models/route.model.js');
const House = require('../models/house.model.js');
const User = require('../models/user.model.js'); // Import User model

// Helper function to calculate distance between two points using Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

// @desc    Update driver's GPS location
// @route   POST /api/driver/location
// @access  Private/Driver
const updateLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  const driverId = req.user._id;
  const driverName = req.user.name;

  // Update driver's isSharingLocation status
  await User.findByIdAndUpdate(driverId, { isSharingLocation: true });

  const gpsLog = await GpsLog.create({
    driver: driverId,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  });

  // Broadcast location via Socket.io to driver and admin
  req.io.to(driverId.toString()).emit('locationUpdate', { driverId, location: gpsLog.location.coordinates });
  req.io.to('admin').emit('locationUpdate', { driverId, location: gpsLog.location.coordinates });

  // Broadcast location to all residents whose houses are assigned to this driver
  try {
    const assignedHouses = await House.find({ assignedDriver: driverId }).select('resident');
    const uniqueResidentIds = [...new Set(assignedHouses.map(house => house.resident.toString()))];

    uniqueResidentIds.forEach(residentId => {
      req.io.to(residentId).emit('locationUpdate', { driverId, location: gpsLog.location.coordinates });
    });
  } catch (error) {
    console.error('Error broadcasting location to residents:', error);
  }

  // Proximity Notification Logic
  const driverCoords = [longitude, latitude];
  const notificationThresholds = [500, 450, 400, 350, 300, 250, 200, 150, 100, 50, 25, 20, 10, 5];

  // Initialize proximityNotifications if it doesn't exist
  if (!req.app.locals.proximityNotifications) {
    req.app.locals.proximityNotifications = {};
  }

  try {
    // Find houses assigned to the driver
    const assignedHouses = await House.find({ assignedDriver: driverId }).populate('resident');

    for (const house of assignedHouses) {
      if (!house.resident || !house.location || !house.location.coordinates) {
        continue;
      }

      const residentId = house.resident._id.toString();
      const residentHouseNo = house.houseNo;
      const houseCoords = house.location.coordinates; // [longitude, latitude]
      
      // getDistanceFromLatLonInKm expects (lat1, lon1, lat2, lon2)
      const distance = getDistanceFromLatLonInKm(driverCoords[1], driverCoords[0], houseCoords[1], houseCoords[0]);

      const notificationKey = `${driverId}-${residentId}`;
      let lastNotifiedDistance = req.app.locals.proximityNotifications[notificationKey] || Infinity;

      // Reset notification state if driver is outside the largest radius
      if (distance > notificationThresholds[0]) {
        if (lastNotifiedDistance !== Infinity) {
            req.app.locals.proximityNotifications[notificationKey] = Infinity;
        }
        continue; // Skip to the next house
      }

      // Find the next notification threshold that has been crossed
      let thresholdToNotify = null;
      for (const threshold of notificationThresholds) {
        if (distance <= threshold && lastNotifiedDistance > threshold) {
          thresholdToNotify = threshold;
          break; // Found the closest new threshold crossed
        }
      }
      
      if (thresholdToNotify) {
        const message = `${driverName} is approximately ${thresholdToNotify} meters away from your house (${residentHouseNo}).`;
        
        req.io.to(residentId).emit('proximityAlert', {
          message,
          driverId,
          distance: thresholdToNotify,
          timestamp: new Date(),
        });
        // Store the threshold that was just notified for
        req.app.locals.proximityNotifications[notificationKey] = thresholdToNotify;
      }
    }

  } catch (error) {
    console.error('Error in proximity notification logic:', error);
  }

  res.status(201).json(gpsLog);
};

// @desc    Get assigned route for the day
// @route   GET /api/driver/route
// @access  Private/Driver
const getMyRoute = async (req, res) => {
  const driverId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let route = await Route.findOne({
    driver: driverId,
    date: { $gte: today },
  }).populate({
    path: 'houses.house', // Populate the 'house' field within each object in the 'houses' array
    populate: {
      path: 'resident', // Populate the 'resident' field within each populated 'house'
      select: 'name email'
    }
  });

  if (!route) {
    // If no route for today, create one with all assigned houses
    const houses = await House.find({ assignedDriver: driverId });
    if(houses.length > 0) {
      route = await Route.create({
        driver: driverId,
        houses: houses.map(h => ({ house: h._id, pickupStatus: 'pending' })), // Create with new structure
      });
      route = await route.populate({
        path: 'houses.house',
        populate: {
          path: 'resident',
          select: 'name email'
        }
      });
    }
  }

  if (route) {
    res.json(route);
  } else {
    res.status(404).json({ message: 'No route assigned for today' });
  }
};

// @desc    Mark pickup status
// @route   PUT /api/driver/pickup/:houseId
// @access  Private/Driver
const markPickupStatus = async (req, res) => {
    const { houseId } = req.params;
    const { status } = req.body; // status: 'picked' or 'not_picked' (lowercase to match enum)
    const driverId = req.user._id;
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const route = await Route.findOne({
        driver: driverId,
        date: { $gte: today },
    }).populate('houses.house');

    if (!route) {
        return res.status(404).json({ message: 'No active route found for driver today.' });
    }

    const houseEntry = route.houses.find(h => h.house._id.toString() === houseId);

    if (houseEntry) {
        houseEntry.pickupStatus = status;
        await route.save();
        
        console.log(`Driver ${req.user.name} marked house ${houseId} as ${status}`);
        
        // Notify resident via Socket.io
        if (houseEntry.house.resident) {
          req.io.to(houseEntry.house.resident.toString()).emit('pickupStatus', { 
            houseId, 
            status, 
            driverId: req.user._id, 
            residentId: houseEntry.house.resident.toString() 
          });
        }
        req.io.to('admin').emit('pickupStatus', { houseId, status, driverId: req.user._id });
        
        res.json({ message: `House ${houseId} marked as ${status}`, route });
    } else {
        res.status(404).json({ message: 'House not found in current route.' });
    }
  };

// @desc    Stop sharing driver's GPS location
// @route   POST /api/driver/stop-location
// @access  Private/Driver
const stopSharingLocation = async (req, res) => {
  const driverId = req.user._id;
  await User.findByIdAndUpdate(driverId, { isSharingLocation: false });
  res.status(200).json({ message: 'Location sharing stopped successfully' });
};

module.exports = {
  updateLocation,
  getMyRoute,
  markPickupStatus,
  stopSharingLocation,
};

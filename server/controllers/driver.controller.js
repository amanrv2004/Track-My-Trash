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
  const proximityThreshold = 500; // meters

  // Initialize proximityNotifications if it doesn't exist
  if (!req.app.locals.proximityNotifications) {
    req.app.locals.proximityNotifications = {};
  }

  try {
    // Find houses within 500m radius (MongoDB geospatial query)
    const nearbyHouses = await House.find({
      assignedDriver: driverId,
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: driverCoords
          },
          $maxDistance: proximityThreshold // 500 meters
        }
      }
    }).populate('resident');

    for (const house of nearbyHouses) {
      if (!house.resident || !house.location || !house.location.coordinates) {
        continue;
      }

      const residentId = house.resident._id.toString();
      const residentHouseNo = house.houseNo;
      
      const notificationKey = `${driverId}-${residentId}`;
      let alreadyNotified = req.app.locals.proximityNotifications[notificationKey];

      if (!alreadyNotified) {
        const message = `${driverName} is near your house (${residentHouseNo}).`;
        
        req.io.to(residentId).emit('proximityAlert', {
          message,
          driverId,
          timestamp: new Date(),
        });
        req.app.locals.proximityNotifications[notificationKey] = true;
      }
    }
    
    // Bonus: Reset notification status for houses that are no longer nearby
    const nearbyHouseIds = nearbyHouses.map(h => h._id.toString());
    for (const key in req.app.locals.proximityNotifications) {
        if (req.app.locals.proximityNotifications.hasOwnProperty(key)) {
            const [dId, rId] = key.split('-');
            if (dId === driverId.toString()) {
                const house = await House.findOne({resident: rId});
                if(house && !nearbyHouseIds.includes(house._id.toString())){
                    req.app.locals.proximityNotifications[key] = false;
                }
            }
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
    }).populate({
        path: 'houses.house',
        populate: {
            path: 'resident',
            select: '_id' // Only populate the _id, as that's all we need for the socket emission
        }
    });

    if (!route) {
        return res.status(404).json({ message: 'No active route found for driver today.' });
    }

    const houseEntry = route.houses.find(h => h.house._id.toString() === houseId);

    console.log('--- Debugging markPickupStatus ---');
    console.log('Driver ID:', driverId);
    console.log('House ID:', houseId);
    console.log('Route (after populate):', route);
    console.log('Found houseEntry:', houseEntry);
    if (houseEntry) {
        console.log('houseEntry.house:', houseEntry.house);
        console.log('houseEntry.house.resident:', houseEntry.house.resident);
    }
    console.log('---------------------------------');

    if (houseEntry) {
        houseEntry.pickupStatus = status;
        await route.save();
        
        console.log(`Driver ${req.user.name} marked house ${houseId} as ${status}`);
        
        // Notify resident via Socket.io
        if (houseEntry.house.resident && houseEntry.house.resident._id) { // Added _id check
          req.io.to(houseEntry.house.resident._id.toString()).emit('pickupStatus', { 
            houseId, 
            status, 
            driverId: req.user._id, 
            residentId: houseEntry.house.resident._id.toString() // Ensure _id is used here too
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
  req.io.to('admin').emit('driverStoppedLocation', { driverId }); // Emit to admin room
  res.status(200).json({ message: 'Location sharing stopped successfully' });
};

module.exports = {
  updateLocation,
  getMyRoute,
  markPickupStatus,
  stopSharingLocation,
};

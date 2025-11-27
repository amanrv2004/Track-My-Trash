const User = require('../models/user.model.js');
const House = require('../models/house.model.js');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  const users = await User.find({}).populate('house');
  res.json(users);
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').populate('house');
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;

    if (req.body.password) {
      user.password = req.body.password;
    }

    if (user.role === 'resident') {
      if (req.body.isSubscribed !== undefined) {
        user.isSubscribed = req.body.isSubscribed;
      }
      // Clear driver specific fields if role changed to resident
      user.vehicleNumber = undefined;
      user.phone = undefined;
    } else if (user.role === 'driver') {
      user.vehicleNumber = req.body.vehicleNumber || user.vehicleNumber;
      user.phone = req.body.phone || user.phone;
      // Clear resident specific fields if role changed to driver
      user.isSubscribed = undefined; // Assuming resident-specific
      user.house = undefined; // Assuming resident-specific
    } else { // Admin
      // Clear all role-specific fields
      user.isSubscribed = undefined;
      user.vehicleNumber = undefined;
      user.phone = undefined;
      user.house = undefined;
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isSubscribed: updatedUser.isSubscribed,
      vehicleNumber: updatedUser.vehicleNumber,
      phone: updatedUser.phone,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    if (user.role === 'resident') {
      await House.deleteOne({ resident: user._id });
    }
    await User.deleteOne({ _id: user._id }); // Use deleteOne instead of deprecated remove()
    res.json({ message: 'User removed' });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

const assignDriverToArea = async (req, res) => {
  const { block, sector, driverId } = req.body;

  if (!block && !sector) {
    res.status(400);
    throw new Error('Either block or sector must be provided');
  }

  const driver = await User.findById(driverId);
  if (!driver || driver.role !== 'driver') {
    res.status(404);
    throw new Error('Driver not found or user is not a driver');
  }

  const today = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1); // Set expiry to 1 month from now

  let filter = {};
  if (block) {
    filter.block = block;
  }
  if (sector) {
    filter.sector = sector;
  }

  try {
    const housesToAssign = await House.find(filter).populate('resident', 'name email');

    const result = await House.updateMany(filter, {
      assignedDriver: driverId,
      assignmentDate: today,
      assignmentExpiryDate: expiryDate,
    });

    if (result.matchedCount === 0) {
      res.status(404);
      throw new Error('No houses found for the specified block/sector');
    }

    // --- Send Socket.io Notifications ---
    const io = req.io;
    const driverData = {
      _id: driver._id,
      name: driver.name,
      email: driver.email,
      vehicleNumber: driver.vehicleNumber,
      phone: driver.phone,
    };

    for (const house of housesToAssign) {
      if (house.resident) {
        io.to(house.resident._id.toString()).emit('driverAssigned', {
          message: `A new driver, ${driver.name}, has been assigned to your area.`,
          driver: driverData,
        });
      }
    }
    // --- End Socket.io Notifications ---

    res.json({ message: `Driver ${driver.name} assigned to ${result.matchedCount} houses in ${block ? 'Block ' + block : ''}${block && sector ? ' and ' : ''}${sector ? 'Sector ' + sector : ''} successfully until ${expiryDate.toDateString()}` });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to assign driver to area: ' + error.message);
  }
};

// @desc    Unassign driver from a house
// @route   PUT /api/admin/houses/:houseId/unassign-driver
// @access  Private/Admin
const unassignDriverFromHouse = async (req, res) => {
  const { houseId } = req.params;

  const house = await House.findById(houseId).populate('resident', 'name email').populate('assignedDriver', 'name');

  if (!house) {
    res.status(404);
    throw new Error('House not found');
  }

  const oldDriverName = house.assignedDriver ? house.assignedDriver.name : 'The driver';

  house.assignedDriver = null;
  house.assignmentDate = null;
  house.assignmentExpiryDate = null;

  await house.save();

  // --- Send Socket.io Notification ---
  const io = req.io;
  if (house.resident) {
    io.to(house.resident._id.toString()).emit('driverUnassigned', {
      message: `${oldDriverName} has been unassigned from your house.`,
    });
  }
  // --- End Socket.io Notification ---

  res.json({ message: `Driver unassigned from house ${house.houseNo}, ${house.block}, ${house.sector}` });
};

// @desc    Unassign driver from an area (block/sector)
// @route   PUT /api/admin/unassign-driver-from-area
// @access  Private/Admin
const unassignDriverFromArea = async (req, res) => {
  const { block, sector, driverId } = req.body; // Added driverId

  if (!driverId) {
      res.status(400);
      throw new Error('DriverId must be provided to unassign.');
  }
  
  if (!block && !sector) {
    res.status(400);
    throw new Error('Either block or sector must be provided to unassign.');
  }

  let filter = {
    assignedDriver: driverId
  };
  if (block) {
    filter.block = block;
  }
  if (sector) {
    filter.sector = sector;
  }


  try {
    // Find houses BEFORE updating to get their current assignedDriver and resident info
    const housesToUnassign = await House.find(filter) // Use updated filter
      .populate('assignedDriver', 'name email') // Populate to get driver's name for message
      .populate('resident', 'name email'); // Populate to get resident's name for message

    const result = await House.updateMany(filter, { // Use updated filter
      assignedDriver: null,
      assignmentDate: null,
      assignmentExpiryDate: null,
    });

    if (result.matchedCount === 0) {
      res.status(404);
      throw new Error(`No houses found for the specified driver and block/sector with an assigned driver to unassign.`);
    }

    // --- Send Socket.io Notifications ---
    const io = req.io; // Assuming req.io is available

    if (housesToUnassign.length > 0) {
      const driverName = housesToUnassign[0].assignedDriver?.name || 'N/A';
      
      for (const house of housesToUnassign) {
          // Notify resident
          if (house.resident) {
            const residentMessage = `ALERT: Your driver (${driverName}) for house ${house.houseNo} has been unassigned from your area.`;
            io.to(house.resident._id.toString()).emit('driverUnassigned', { message: residentMessage, type: 'resident_alert' });
          }
      }

      // Notify the affected driver
      const driverMessage = `ALERT: You (${driverName}) have been unassigned from ${result.matchedCount} houses in Block ${block || 'N/A'}/Sector ${sector || 'N/A'}.`;
      io.to(driverId).emit('driverUnassigned', { message: driverMessage, type: 'driver_alert' });
      

      // Notify admin
      const adminMessage = `Admin Action: Driver ${driverName} unassigned from ${result.matchedCount} houses in Block ${block || 'N/A'}/Sector ${sector || 'N/A'}.`;
      io.to('admin').emit('driverUnassigned', { message: adminMessage, type: 'admin_alert' });
    }
    // --- End Socket.io Notifications ---


    res.json({ message: `Driver unassigned from ${result.matchedCount} houses in ${block ? 'Block ' + block : ''}${block && sector ? ' and ' : ''}${sector ? 'Sector ' + sector : ''} successfully.` });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to unassign driver from area: ' + error.message);
  }
};



module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  assignDriverToArea,
  unassignDriverFromHouse,
  unassignDriverFromArea,
};

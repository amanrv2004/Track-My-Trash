const EmergencyRequest = require('../models/emergencyRequest.model.js');
const House = require('../models/house.model.js');

// @desc    Create a new emergency request
// @route   POST /api/emergency-requests
// @access  Private/Resident
const createEmergencyRequest = async (req, res) => {
  const { resident, reason, preferredTime, house } = req.body;

  const newRequest = await EmergencyRequest.create({
    resident,
    reason,
    preferredTime,
    house,
  });

  const populatedRequest = await EmergencyRequest.findById(newRequest._id).populate('resident', 'name email');

  // Notify admin
  req.io.to('admin').emit('newEmergencyRequest', populatedRequest);

  // Notify assigned driver
  const houseDetails = await House.findById(house);
  if (houseDetails && houseDetails.assignedDriver) {
    req.io.to(houseDetails.assignedDriver.toString()).emit('emergencyRequest', populatedRequest);
  }

  res.status(201).json(populatedRequest);
};

// @desc    Get all emergency requests
// @route   GET /api/emergency-requests
// @access  Private/Admin
const getAllEmergencyRequests = async (req, res) => {
  const requests = await EmergencyRequest.find({}).populate('resident', 'name email');
  res.json(requests);
};

// @desc    Update emergency request status
// @route   PUT /api/emergency-requests/:id
// @access  Private/Admin
const updateEmergencyRequestStatus = async (req, res) => {
  const { status, assignedDriver } = req.body;
  const request = await EmergencyRequest.findById(req.params.id);

  if (request) {
    request.status = status;
    if (assignedDriver) {
      request.assignedDriver = assignedDriver;
    }
    const updatedRequest = await request.save();

    // Populate resident and assignedDriver before emitting socket event
    const populatedUpdatedRequest = await EmergencyRequest.findById(updatedRequest._id)
      .populate('resident', 'name email')
      .populate('assignedDriver', 'name email vehicleNumber phone'); // Populate driver details

    // Emit a single, comprehensive update event
    if (populatedUpdatedRequest.resident) {
      req.io.to(populatedUpdatedRequest.resident._id.toString()).emit('emergencyRequestUpdate', populatedUpdatedRequest);
    }
    if (populatedUpdatedRequest.assignedDriver) {
      req.io.to(populatedUpdatedRequest.assignedDriver._id.toString()).emit('emergencyRequestUpdate', populatedUpdatedRequest);
    }
    req.io.to('admin').emit('emergencyRequestUpdate', populatedUpdatedRequest);

    res.json(populatedUpdatedRequest);
  } else {
    res.status(404).json({ message: 'Emergency request not found' });
  }
};

module.exports = {
  createEmergencyRequest,
  getAllEmergencyRequests,
  updateEmergencyRequestStatus,
};
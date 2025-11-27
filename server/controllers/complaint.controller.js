const Complaint = require('../models/complaint.model.js');

// @desc    Get all complaints
// @route   GET /api/complaints
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
  const complaints = await Complaint.find({}).populate('resident', 'name email');
  res.json(complaints);
};

// @desc    Update complaint status
// @route   PUT /api/complaints/:id
// @access  Private/Admin
const updateComplaintStatus = async (req, res) => {
  const { status } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (complaint) {
    complaint.status = status;
    const updatedComplaint = await complaint.save();
    res.json(updatedComplaint);
  } else {
    res.status(404).json({ message: 'Complaint not found' });
  }
};

module.exports = {
  getAllComplaints,
  updateComplaintStatus,
};
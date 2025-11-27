const express = require('express');
const router = express.Router();
const { getAllComplaints, updateComplaintStatus } = require('../controllers/complaint.controller.js');
const { protect, admin } = require('../middleware/auth.middleware.js');

router.route('/').get(protect, admin, getAllComplaints);
router.route('/:id').put(protect, admin, updateComplaintStatus);

module.exports = router;

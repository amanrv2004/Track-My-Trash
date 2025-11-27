const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  assignDriverToArea, // Changed from assignDriverToHouse
  unassignDriverFromHouse,
  unassignDriverFromArea,
} = require('../controllers/admin.controller.js');
const { protect, admin } = require('../middleware/auth.middleware.js');

router.route('/users').get(protect, getUsers);
router.route('/users/:id').get(protect, getUserById).put(protect, updateUser).delete(protect, deleteUser);
router.route('/assign-driver-to-area').post(protect, assignDriverToArea);
router.put('/houses/:houseId/unassign-driver', protect, unassignDriverFromHouse);
router.put('/unassign-driver-from-area', protect, unassignDriverFromArea);

module.exports = router;

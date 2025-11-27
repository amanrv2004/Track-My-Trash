const express = require('express');
const router = express.Router();
const {
  registerResident,
  registerDriver,
  authUser,
} = require('../controllers/user.controller.js');
const { protect, admin } = require('../middleware/auth.middleware.js');

router.post('/register/resident', registerResident);
router.post('/register/driver', protect, admin, registerDriver);
router.post('/login', authUser);

module.exports = router;

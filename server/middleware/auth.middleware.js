const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model.js');

const protect = asyncHandler(async (req, res, next) => {
  let token = null; // Initialize token to null

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Protect middleware - Received token:', token);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Protect middleware - Decoded token:', decoded);
      req.user = await User.findById(decoded.id).select('-password');
      console.log('Protect middleware - req.user:', req.user);
      next(); // Call next only if successful
    } catch (error) {
      console.error('Protect middleware - Error:', error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  // If no token was found after checking the header or if it was invalid
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const admin = (req, res, next) => {
  console.log('Admin middleware - req.user:', req.user);
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

const driver = (req, res, next) => {
  if (req.user && req.user.role === 'driver') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as a driver');
  }
};

const resident = (req, res, next) => {
  if (req.user && req.user.role === 'resident') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as a resident');
  }
};

module.exports = { protect, admin, driver, resident };

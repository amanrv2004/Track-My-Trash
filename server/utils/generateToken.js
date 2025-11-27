const jwt = require('jsonwebtoken');

const generateToken = (id, role, isSubscribed) => {
  return jwt.sign({ id, role, isSubscribed }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = generateToken;

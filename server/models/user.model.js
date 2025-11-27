const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['resident', 'driver', 'admin'],
    required: true,
  },
  isSubscribed: { // For residents
    type: Boolean,
    default: false,
  },
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
  },
  // Driver specific fields
  vehicleNumber: {
    type: String,
    required: function() { return this.role === 'driver'; }, // Conditionally required for drivers
  },
  phone: {
    type: String,
    required: function() { return this.role === 'driver'; }, // Conditionally required for drivers
  },
  // Location for drivers (GeoJSON Point)
  location: {
    type: {
          type: String,
          enum: ['Point'],
          required: false, // Changed to optional as location is not always present
          },
          coordinates: {
            type: [Number],
            index: '2dsphere' // 2dsphere index for geospatial queries
          }
        },
        isSharingLocation: { // For drivers to indicate if they are actively sharing location
          type: Boolean,
          default: false,
        }
      }, {
        timestamps: true,
      });
// Password hashing middleware
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Password comparison method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

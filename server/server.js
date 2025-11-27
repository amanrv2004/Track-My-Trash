const dotenv = require('dotenv'); // Added import
dotenv.config();

const express = require('express');
const http = require('http');
const { initSocket } = require('./utils/socket.js');
const paymentRoutes = require('./routes/payment.routes.js');
const { stripeWebhook } = require('./controllers/payment.controller.js'); // Import webhook handler directly
const emergencyRequestRoutes = require('./routes/emergencyRequest.routes.js');
const complaintRoutes = require('./routes/complaint.routes.js');
const houseRoutes = require('./routes/house.routes.js');
const residentRoutes = require('./routes/resident.routes.js');
const driverRoutes = require('./routes/driver.routes.js');
const adminRoutes = require('./routes/admin.routes.js');
const userRoutes = require('./routes/user.routes.js');
const User = require('./models/user.model.js');
const connectDB = require('./config/db.js'); // Added import
const cors = require('cors');
const setupIrregularityCron = require('./utils/irregularityCheck.js'); // Import cron setup function
console.log('Type of setupIrregularityCron:', typeof setupIrregularityCron);
const app = express();
app.locals.proximityNotifications = {}; // Initialize in-memory store for proximity notifications
const server = http.createServer(app);
const io = initSocket(server);

// Middleware to attach io to each request
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Stripe webhook needs raw body - This MUST come BEFORE express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(cors());
app.use(express.json()); // Now it's safe to parse JSON for other routes

// Seed admin user
const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (adminExists) {
      if (adminExists.role !== 'admin') {
        adminExists.role = 'admin';
        await adminExists.save();
        console.log(`User with email ${process.env.ADMIN_EMAIL} promoted to admin.`);
      } else {
        console.log('Admin user already exists.');
      }
      return;
    }

    // Create a new admin user
    const adminUser = await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log('Admin user created successfully.');;
  } catch (error) {
    console.error(`Error seeding admin user: ${error.message}`);
    process.exit(1);
  }
};
connectDB();
seedAdmin();


app.get('/', (req, res) => {
  res.send('Track My Trash API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/resident', residentRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/emergency-requests', emergencyRequestRoutes);
app.use('/api/payments', paymentRoutes); // All other payment routes (excluding webhook which is handled above)

// Error handling middleware
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
}

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
}

app.use(notFound);
app.use(errorHandler);


const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  setupIrregularityCron(); // Start CRON job
});

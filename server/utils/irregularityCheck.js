const nodeCron = require('node-cron');
const Complaint = require('../models/complaint.model.js');
const Subscription = require('../models/subscription.model.js');
const House = require('../models/house.model.js'); // Added House model
const { getIO } = require('./socket.js');

module.exports = () => {
  // Schedule to run every day at a specific time (e.g., 2 AM)
  nodeCron.schedule('0 2 * * *', async () => {
    console.log('Running daily irregularity check...');
    const io = getIO();

    try {
      // Check for complaints (e.g., if a pickup was marked as done but resident complained)
      // This logic would need more refinement based on how pickups are truly confirmed and recorded.
      // For now, we'll just check for any pending complaints as a general alert.
      const pendingComplaints = await Complaint.find({ status: 'pending' }).populate('resident', 'name email');
      if (pendingComplaints.length > 0) {
        const message = `ALERT: ${pendingComplaints.length} pending complaints need attention!`;
        console.warn(message);
        io.to('admin').emit('irregularityAlert', { type: 'complaint', message, details: pendingComplaints });
      }

      // Check for expiring subscriptions (e.g., expiring in the next 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringSubscriptions = await Subscription.find({
        endDate: { $lte: sevenDaysFromNow, $gte: new Date() }, // Expiring within the next 7 days
        status: 'active',
      }).populate('resident', 'name email');

      if (expiringSubscriptions.length > 0) {
        const message = `ALERT: ${expiringSubscriptions.length} subscriptions are expiring soon!`;
        console.warn(message);
        io.to('admin').emit('irregularityAlert', { type: 'subscription_expiry', message, details: expiringSubscriptions });
        // You might also send notifications to residents
      }

      // Check for expired driver assignments
      await checkAssignmentExpiry(io);

      console.log('Irregularity check completed.');
    } catch (error) {
      console.error('Error during irregularity check cron job:', error);
    }
  });
};

const checkAssignmentExpiry = async (io) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  try {
    const expiredAssignments = await House.find({
      assignmentExpiryDate: { $lte: today },
      assignedDriver: { $ne: null }
    }).populate('assignedDriver', 'name email').populate('resident', 'name email');

    if (expiredAssignments.length > 0) {
      console.log(`Found ${expiredAssignments.length} expired driver assignments.`);
      for (const house of expiredAssignments) {
        // Unassign driver
        house.assignedDriver = null;
        house.assignmentDate = null;
        house.assignmentExpiryDate = null;
        await house.save();

        const message = `ALERT: Driver ${house.assignedDriver?.name || 'N/A'} for house ${house.houseNo}, ${house.block}, ${house.sector} (Resident: ${house.resident?.name || 'N/A'}) has expired and needs re-assignment!`;
        console.warn(message);
        io.to('admin').emit('irregularityAlert', { type: 'assignment_expiry', message, details: { houseId: house._id, residentId: house.resident?._id, driverId: house.assignedDriver?._id } });
      }
      console.log('Expired assignments processed.');
    }
  } catch (error) {
    console.error('Error during assignment expiry check:', error);
  }
};

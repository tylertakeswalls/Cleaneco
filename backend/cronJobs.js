const cron = require('node-cron');
const User = require('./models/User');

const startCronJobs = () => {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily cron job for account deletions...');
      
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const usersToDelete = await User.find({
        delete_requested: true,
        delete_requested_at: { $lte: ninetyDaysAgo }
      });

      if (usersToDelete.length > 0) {
        console.log(`Found ${usersToDelete.length} accounts to delete.`);
        for (const user of usersToDelete) {
          await User.findByIdAndDelete(user._id);
          console.log(`Automatically deleted user: ${user.email} (Requested > 90 days ago)`);
        }
      } else {
        console.log('No pending accounts older than 90 days found.');
      }
    } catch (error) {
      console.error("Cron job error deleting accounts:", error);
    }
  });
};

module.exports = startCronJobs;

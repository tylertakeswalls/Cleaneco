/**
 * Evaluator Test Data Cleanup Script
 * Reference: UI/UX Expert Evaluation Report (ISO/IEC 25010 Framework), Page 13.
 * 
 * Purges the evaluator's test booking (#ORD1793547553093521) and any dummy accounts
 * created during the evaluation period (Nov 1–2, 2026).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

const TEST_ORDER_ID = 'ORD1793547553093521';

async function cleanup() {
  console.log('Connecting to MongoDB Atlas for evaluation data cleanup...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected successfully.\n');

  // 1. Locate test order
  const testOrders = await Order.find({ order_id: TEST_ORDER_ID });
  if (testOrders.length === 0) {
    console.log(`[INFO] Test order #${TEST_ORDER_ID} was not found or already cleaned up.`);
  } else {
    console.log(`[FOUND] Found ${testOrders.length} record(s) matching order #${TEST_ORDER_ID}.`);
    const userIds = testOrders.map(o => o.user_id).filter(Boolean);

    // Delete associated notifications and messages
    const notifResult = await Notification.deleteMany({ order_id: TEST_ORDER_ID });
    console.log(`[DELETED] Removed ${notifResult.deletedCount} notification(s) for #${TEST_ORDER_ID}.`);

    const msgResult = await Message.deleteMany({ order_id: TEST_ORDER_ID });
    console.log(`[DELETED] Removed ${msgResult.deletedCount} chat message(s) for #${TEST_ORDER_ID}.`);

    // Delete the order itself
    const orderResult = await Order.deleteMany({ order_id: TEST_ORDER_ID });
    console.log(`[DELETED] Removed ${orderResult.deletedCount} order record(s) for #${TEST_ORDER_ID}.`);

    // Check if the user is a dummy evaluator account
    for (const uid of userIds) {
      const user = await User.findById(uid);
      if (user) {
        const isDummy = /review|test|evaluat|dummy/i.test(user.username) || /review|test|evaluat|dummy/i.test(user.email);
        if (isDummy) {
          await User.findByIdAndDelete(uid);
          console.log(`[DELETED] Purged evaluator dummy account: ${user.username} (${user.email})`);
        } else {
          console.log(`[SKIPPED] User account ${user.username} is not explicitly marked as dummy; kept safe.`);
        }
      }
    }
  }

  // 2. Also search for any orphaned test accounts created Nov 1-2 with reviewer/evaluator usernames
  const dummyUsers = await User.find({
    $or: [
      { username: /test_reviewer|ui_ux_expert|evaluator_dummy/i },
      { email: /test.*@cleaneco|expert.*@dlsu/i }
    ]
  });

  if (dummyUsers.length > 0) {
    console.log(`\nFound ${dummyUsers.length} dummy evaluator account(s):`);
    for (const u of dummyUsers) {
      await User.findByIdAndDelete(u._id);
      console.log(`[DELETED] Purged dummy user: ${u.username} (${u.email})`);
    }
  }

  console.log('\n======================================================');
  console.log('EVALUATOR TEST DATA CLEANUP COMPLETED SUCCESSFULLY');
  console.log('======================================================');
  process.exit(0);
}

cleanup().catch(err => {
  console.error('[ERROR] Cleanup failed:', err.message);
  process.exit(1);
});


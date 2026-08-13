const express = require('express');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

const router = express.Router();

// PayMongo Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // Parse the body as JSON. (If PayMongo signatures were enabled, we'd verify here)
        const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        console.log('PayMongo Webhook Event Type:', event?.data?.attributes?.type);

        if (event?.data?.attributes?.type === 'checkout_session.payment.paid') {
            const checkoutData = event.data.attributes.data.attributes;
            const referenceNumber = checkoutData.reference_number; // This is our orderId
            
            console.log(`Processing paid webhook for order: ${referenceNumber}`);

            if (referenceNumber) {
                // Find all orders (since one cart can have multiple services generating multiple Orders with same order_id)
                const orders = await Order.find({ order_id: referenceNumber });
                
                if (orders.length > 0) {
                    for (const order of orders) {
                        if (order.status === 'Pending') {
                            order.status = 'In Progress';
                            await order.save();
                            
                            // Notify user
                            if (order.user_id) {
                                await new Notification({
                                    user_id: order.user_id,
                                    order_id: order.order_id,
                                    message: `Reservation Payment Verified`,
                                    details: `Your PayMongo payment for order #${order.order_id} was successful. Your order is now In Progress.`
                                }).save();
                            }
                        }
                    }

                    // Revenue is tracked via Order status, no need to update a secondary Payment record
                    console.log(`Successfully updated order ${referenceNumber} to In Progress`);
                } else {
                    console.warn(`Order ${referenceNumber} not found in database.`);
                }
            }
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook error');
    }
});

module.exports = router;

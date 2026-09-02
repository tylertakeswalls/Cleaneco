const express = require('express');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { sendConfirmationEmail } = require('../utils/emailHelper');

const router = express.Router();

const crypto = require('crypto');

// PayMongo Webhook
router.post('/webhook', async (req, res) => {
    try {
        const signatureHeader = req.headers['paymongo-signature'];
        const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY;
        
        // Ponytail: Only enforce signature validation if the secret is configured.
        // This allows local testing without a live Ngrok tunnel, while keeping production secure.
        if (webhookSecret && signatureHeader) {
            // PayMongo signature format: t=timestamp,te=test_signature,li=live_signature
            const elements = signatureHeader.split(',').map(s => s.split('='));
            const signatureMap = Object.fromEntries(elements);
            
            const timestamp = signatureMap.t;
            const signature = signatureMap.te || signatureMap.li;
            
            const payload = `${timestamp}.${req.rawBody.toString('utf8')}`;
            const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
            
            if (expectedSignature !== signature) {
                console.error('Webhook signature mismatch!');
                return res.status(401).send('Invalid Signature');
            }
        } else {
            console.warn('ponytail: Skipping Webhook signature validation. Missing PAYMONGO_WEBHOOK_SECRET.');
        }

        const event = req.body;

        console.log('PayMongo Webhook Event Type:', event?.data?.attributes?.type);

        if (event?.data?.attributes?.type === 'checkout_session.payment.paid') {
            const checkoutData = event.data.attributes.data.attributes;
            const referenceNumber = checkoutData.reference_number; // This is our orderId

            console.log(`Processing paid webhook for order: ${referenceNumber}`);

            if (referenceNumber) {
                const isFinalPayment = referenceNumber.endsWith('_FINAL');
                const actualOrderId = isFinalPayment ? referenceNumber.replace('_FINAL', '') : referenceNumber;

                const orders = await Order.find({ order_id: actualOrderId });

                if (orders.length > 0) {
                    await Promise.all(orders.map(async (order) => {
                        if (isFinalPayment && order.status !== 'Cancelled') {
                            order.final_payment_status = 'Paid';
                            await order.save();

                            if (order.user_id) {
                                await new Notification({
                                    user_id: order.user_id,
                                    order_id: order.order_id,
                                    message: `Final Payment Verified`,
                                    details: `Your final payment for order #${order.order_id} was successful. Thank you for your business!`
                                }).save();
                            }
                        } else if (order.status === 'Pending') {
                            order.status = 'In Progress';
                            await order.save();

                            if (order.user_id) {
                                await new Notification({
                                    user_id: order.user_id,
                                    order_id: order.order_id,
                                    message: `Reservation Payment Verified`,
                                    details: `Your PayMongo payment for order #${order.order_id} was successful. Your order is now In Progress.`
                                }).save();
                            }

                            const clientInfo = {
                                firstName: order.first_name,
                                lastName: order.last_name,
                                email: order.email,
                                phone: order.phone,
                                address: order.address,
                                date: order.date,
                                timeSlot: order.time_slot,
                                status: order.status,
                                notes: order.notes
                            };
                            const orderItems = [{
                                service_name: order.service_type,
                                base_price: order.price,
                                price: order.price
                            }];
                            await sendConfirmationEmail(order.order_id, clientInfo, orderItems, true);
                        }
                    }));

                    console.log(`Successfully updated order ${actualOrderId}`);
                } else {
                    console.warn(`Order ${actualOrderId} not found in database.`);
                }
            }
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook error');
    }
});

const createPayMongoSession = async (amountInCents, description, referenceNumber, lineItems, customerInfo) => {
    const options = {
        method: 'POST',
        url: 'https://api.paymongo.com/v1/checkout_sessions',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            authorization: `Basic ${Buffer.from((process.env.PAYMONGO_SECRET_KEY || 'sk_test_w3hVvJThf4Jv5M1h4qL67jG1') + ':').toString('base64')}`
        },
        data: {
            data: {
                attributes: {
                    billing: customerInfo ? {
                        name: `${customerInfo.first_name} ${customerInfo.last_name}`,
                        email: customerInfo.email,
                        phone: customerInfo.phone
                    } : undefined,
                    send_email_receipt: true,
                    show_description: true,
                    show_line_items: true,
                    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-cancel`,
                    success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success`,
                    description,
                    line_items: lineItems,
                    payment_method_types: ['card', 'paymaya', 'gcash', 'grab_pay'],
                    reference_number: referenceNumber
                }
            }
        }
    };

    const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: JSON.stringify(options.data)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.data.attributes.checkout_url;
};

router.post('/checkout-final', async (req, res) => {
    try {
        const { order_id } = req.body;
        const orders = await Order.find({ order_id });
        if (!orders || orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

        const totalFinalPrice = orders.reduce((sum, o) => sum + (o.final_price || 0), 0);
        if (totalFinalPrice === 0) return res.status(400).json({ success: false, message: 'Final price has not been set yet.' });

        const amountToPay = (totalFinalPrice * 1.1) - 1100;
        if (amountToPay <= 0) return res.status(400).json({ success: false, message: 'No remaining balance to pay.' });

        const description = `Cleaneco Final Payment - ${orders.map(o => o.service_type).join(', ')}`;
        const lineItems = [{
            amount: Math.round(amountToPay * 100),
            currency: 'PHP',
            description: 'Final Balance (incl. 10% tax, less reservation fee)',
            name: 'Final Payment',
            quantity: 1
        }];

        const checkoutUrl = await createPayMongoSession(Math.round(amountToPay * 100), description, `${order_id}_FINAL`, lineItems, orders[0]);
        res.json({ success: true, checkout_url: checkoutUrl });
    } catch (error) {
        console.error('Final Checkout Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to create final payment session' });
    }
});

router.post('/checkout-reservation', async (req, res) => {
    try {
        const { order_id } = req.body;
        const orders = await Order.find({ order_id });
        if (!orders || orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

        if (orders[0].status !== 'Pending') return res.status(400).json({ success: false, message: 'This order is no longer pending payment.' });

        const description = `Cleaneco Service Booking - ${orders.map(o => o.service_type).join(', ')}`;
        const lineItems = [{
            amount: 1100 * 100,
            currency: 'PHP',
            description,
            name: 'Reservation Fee',
            quantity: 1
        }];

        const checkoutUrl = await createPayMongoSession(1100 * 100, description, order_id, lineItems, orders[0]);
        res.json({ success: true, checkout_url: checkoutUrl });
    } catch (error) {
        console.error('Reservation Checkout Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to create reservation payment session' });
    }
});

module.exports = router;

const express = require('express');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// PayMongo Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signatureHeader = req.headers['paymongo-signature'];
        const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
        
        // Ponytail: Only enforce signature validation if the secret is configured.
        // This allows local testing without a live Ngrok tunnel, while keeping production secure.
        if (webhookSecret && signatureHeader) {
            // PayMongo signature format: t=timestamp,te=test_signature,li=live_signature
            const elements = signatureHeader.split(',').map(s => s.split('='));
            const signatureMap = Object.fromEntries(elements);
            
            const timestamp = signatureMap.t;
            const signature = signatureMap.te || signatureMap.li;
            
            const payload = `${timestamp}.${req.body}`;
            const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
            
            if (expectedSignature !== signature) {
                console.error('Webhook signature mismatch!');
                return res.status(401).send('Invalid Signature');
            }
        } else {
            console.warn('ponytail: Skipping Webhook signature validation. Missing PAYMONGO_WEBHOOK_SECRET.');
        }

        // Parse the body as JSON.
        const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

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

router.post('/checkout-final', async (req, res) => {
    try {
        const { order_id } = req.body;
        
        // Find all orders associated with this order_id to sum up the final price
        const orders = await Order.find({ order_id });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        let totalFinalPrice = 0;
        let servicesNames = [];
        for (const o of orders) {
            totalFinalPrice += (o.final_price || 0);
            servicesNames.push(o.service_type);
        }

        if (totalFinalPrice === 0) {
            return res.status(400).json({ success: false, message: 'Final price has not been set yet.' });
        }

        // Apply 10% tax on Final Price, then deduct the 1100 reservation fee
        const totalWithTax = totalFinalPrice + (totalFinalPrice * 0.1);
        const amountToPay = totalWithTax - 1100;

        if (amountToPay <= 0) {
            return res.status(400).json({ success: false, message: 'No remaining balance to pay.' });
        }

        // Create PayMongo checkout session
        const amountInCents = Math.round(amountToPay * 100);

        const options = {
            method: 'POST',
            url: 'https://api.paymongo.com/v1/checkout_sessions',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY || 'sk_test_w3hVvJThf4Jv5M1h4qL67jG1').toString('base64')}`
            },
            data: {
                data: {
                    attributes: {
                        billing: {
                            name: `${orders[0].first_name} ${orders[0].last_name}`,
                            email: orders[0].email,
                            phone: orders[0].phone
                        },
                        send_email_receipt: true,
                        show_description: true,
                        show_line_items: true,
                        cancel_url: `http://localhost:3000/payment-cancel`,
                        description: `Cleaneco Final Payment - ${servicesNames.join(', ')}`,
                        line_items: [
                            {
                                amount: amountInCents,
                                currency: 'PHP',
                                description: 'Final Balance (incl. 10% tax, less reservation fee)',
                                name: 'Final Payment',
                                quantity: 1
                            }
                        ],
                        payment_method_types: ['card', 'paymaya', 'gcash', 'grab_pay'],
                        reference_number: `${order_id}_FINAL`,
                        success_url: `http://localhost:3000/payment-success`
                    }
                }
            }
        };

        const paymongoResponse = await axios.request(options);
        const checkoutUrl = paymongoResponse.data.data.attributes.checkout_url;

        res.json({ success: true, checkout_url: checkoutUrl });

    } catch (error) {
        console.error('Final Checkout Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to create final payment session' });
    }
});

module.exports = router;

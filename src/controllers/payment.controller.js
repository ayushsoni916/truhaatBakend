const Razorpay = require('razorpay');
const crypto = require('crypto');
const paymentModel = require('../models/payment.model');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    try {
        const { amount, paymentType, productId, planId } = req.body;
        const userId = req.user._id; // Assuming you have auth middleware

        // 1. Create Order in Razorpay
        const options = {
            amount: amount * 100, // convert to paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
        };

        const razorOrder = await razorpay.orders.create(options);

        // 2. Store in our Database as "Pending"
        const newPayment = await paymentModel.create({
            userId,
            razorpayOrderId: razorOrder.id,
            amount,
            paymentType,
            metadata: {
                productId: productId || null,
                planId: planId || null
            }
        });

        res.status(200).json({
            ...razorOrder,
            localPaymentId: newPayment._id
        });
    } catch (error) {
        res.status(500).json({ message: "Order creation failed", error: error.message });
    }
};

exports.handleWebhook = (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body) // Use raw body here
        .digest('hex');

    if (signature === expectedSignature) {
        const event = JSON.parse(req.body).event;

        if (event === 'order.paid' || event === 'payment.captured') {
            const payment = JSON.parse(req.body).payload.payment.entity;
            console.log("Payment Verified for Order:", payment.order_id);
            // Business Logic: Update your Order/Wallet tables here
        }
        res.status(200).send('ok');
    } else {
        res.status(400).send('Invalid signature');
    }
};
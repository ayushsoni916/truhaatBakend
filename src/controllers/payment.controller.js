const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Expecting amount in INR
        const options = {
            amount: amount * 100, // convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: "Order creation failed", error });
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
const Razorpay = require('razorpay');
const crypto = require('crypto');
const paymentModel = require('../models/payment.model');
const Plan = require('../models/plan.model');
const User = require('../models/user.model');
const PlanPurchase = require('../models/planPurchase.model');
const { processPlanActivation, processCashbackCardActivation } = require('./plan.controller');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    // console.log("🔹 createOrder invoked by user:", req.user);
    try {
        const { planId } = req.body;
        const userId = req.user.id;
        console.log("User ID:", userId, "Plan ID:", planId);

        if (!planId) {
            return res.status(400).json({ message: "planId is required" });
        }

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(400).json({ message: "Invalid or inactive plan configuration" });
        }

        // const calculatedAmount = plan.price;
        const calculatedAmount = 1;

        // 1. Create Order in Razorpay
        const options = {
            amount: Math.round(calculatedAmount * 100), // convert to paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
        };

        const razorOrder = await razorpay.orders.create(options);

        // 2. Store in our Database as "Pending"
        const newPayment = await paymentModel.create({
            userId,
            razorpayOrderId: razorOrder.id,
            amount: calculatedAmount, // Saved consistently in standard Rupees format
            currency: 'INR',
            status: 'Pending',         // Matches exact enum casing
            paymentType: 'Membership', // Matches exact enum casing
            metadata: {
                planId: plan._id
            }
        });

        res.status(200).json({
            id: razorOrder.id,
            amount: razorOrder.amount,
            currency: razorOrder.currency,
            localPaymentId: newPayment._id
        });
    } catch (error) {
        console.error("❌ createOrder error:", error);
        res.status(500).json({ message: "Order creation failed", error: error.message });
    }
};

exports.createCashBackOrder = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        // Secure Rule: Fixed pricing controlled 100% by backend (Set to 1 for testing, or 599 for production)
        const calculatedAmount = 1;

        const options = {
            amount: Math.round(calculatedAmount * 100), // convert to paise
            currency: "INR",
            receipt: `rcpt_cbcard_${Date.now()}`,
        };

        const razorOrder = await razorpay.orders.create(options);

        // Store trace log matching updated enum 'CashbackCard'
        const newPayment = await paymentModel.create({
            userId,
            razorpayOrderId: razorOrder.id,
            amount: calculatedAmount,
            currency: 'INR',
            status: 'Pending',
            paymentType: 'CashbackCard', // Maps directly to updated schema enum
            metadata: {}
        });

        res.status(200).json({
            id: razorOrder.id,
            amount: razorOrder.amount,
            currency: razorOrder.currency,
            localPaymentId: newPayment._id
        });
    } catch (error) {
        console.error("❌ createCashBackOrder error:", error);
        res.status(500).json({ message: "Order creation failed", error: error.message });
    }
};

exports.handleWebhook = async (req, res) => {
    console.log("📡 Razorpay Webhook Received:", req.body);
    const signature = req.headers['x-razorpay-signature'];
    // const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSecret = 'myLocalSecret123'; // For local testing, replace with env variable in production

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body) // Use raw body here
        .digest('hex');

    if (signature !== expectedSignature) {
        console.error("❌ Webhook validation failed: Cryptographic signature mismatch.");
        return res.status(400).send('Invalid signature verification payload.');
    }
    const parsedBody = JSON.parse(req.body);
    const event = parsedBody.event;

    console.log(`📡 Razorpay Webhook Event Hook Triggered: ${event}`);
    if (signature === expectedSignature) {
        const event = JSON.parse(req.body).event;

        if (event === 'order.paid' || event === 'payment.captured') {

            // Extract entities universally depending on event shape
            const paymentEntity = parsedBody.payload.payment.entity;
            const targetOrderId = paymentEntity.order_id;
            const targetPaymentId = paymentEntity.id;

            console.log(`💳 Processing business logic for Order: ${targetOrderId}`);

            // 3. Find matching local pending record inside your unified Payment tracking system
            const paymentDoc = await paymentModel.findOne({ razorpayOrderId: targetOrderId });

            if (!paymentDoc) {
                console.error(`⚠️ Payment record reference missing for incoming order: ${targetOrderId}`);
                return res.status(200).send('ok'); // Return 200 to stop retry loops
            }

            // 4. Idempotency Check: Short-circuit if this order was handled by the alternate event
            if (paymentDoc.status === 'Success') {
                console.log(`ℹ️ Order ${targetOrderId} already processed successfully. Skipping repeat loop.`);
                return res.status(200).send('ok');
            }

            // 5. Update Unified Ledger Document
            paymentDoc.status = 'Success';
            await paymentDoc.save();
            console.log(`📝 Unified Payment doc updated to Success for user: ${paymentDoc.userId}`);

            // 6. Plan Allocation Logic if paymentType matches 'Membership'
            if (paymentDoc.paymentType === 'Membership') {
                console.log(`🎯 Context matches 'Membership'. Routing flow directly inside plan.controller...`);

                try {
                    // Call it directly as a standard function by injecting the IDs straight through
                    await processPlanActivation(
                        paymentDoc.userId,
                        paymentDoc.metadata?.planId,
                        targetOrderId,
                        targetPaymentId
                    );
                    console.log(`✅ Membership activation loop processed cleanly.`);
                } catch (activationError) {
                    console.error(`❌ Plan worker error during webhook lifecycle:`, activationError.message);
                }
            }
            else if (paymentDoc.paymentType === 'CashbackCard') {
                console.log(`🎯 Context matches 'CashbackCard'. Activating pure worker function...`);
                try {
                    await processCashbackCardActivation(
                        paymentDoc.userId,
                        targetOrderId,
                        targetPaymentId
                    );
                    console.log(`✅ Cashback Card wallet and access privileges successfully activated.`);
                } catch (err) {
                    console.error(`❌ Cashback Card activation worker failure:`, err.message);
                }
            }
        }
        res.status(200).send('ok');
    } else {
        res.status(400).send('Invalid signature');
    }
};
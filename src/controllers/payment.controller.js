const Razorpay = require('razorpay');
const crypto = require('crypto');
const paymentModel = require('../models/payment.model');
const Plan = require('../models/plan.model');
const User = require('../models/user.model');
const PlanPurchase = require('../models/planPurchase.model');
const { processPlanActivation, processCashbackCardActivation } = require('./plan.controller');
const { processServiceBooking } = require('./serviceControllers/serviceBooking.controller');
const orderModel = require('../models/Shop/order.model');
const offlineCartModel = require('../models/Shop/offlineCart.model');
const cashbackWalletModel = require('../models/cashbackWallet.model');
const cashbackTransactionModel = require('../models/cashbackTransaction.model'); // Adjust path if needed

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
    try {
        console.log("📡 Razorpay Webhook Received.");

        const signature = req.headers['x-razorpay-signature'];
        // const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const webhookSecret = 'myLocalSecret123'; // For local testing, replace in production

        // 1. Validate Signature (Requires req.body to be a raw buffer/string)
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error("❌ Webhook validation failed: Cryptographic signature mismatch.");
            return res.status(400).send('Invalid signature verification payload.');
        }

        // 2. Parse Body and Extract Event
        const parsedBody = JSON.parse(req.body);
        const event = parsedBody.event;
        console.log(`📡 Razorpay Webhook Event Hook Triggered: ${event}`);

        // 3. Handle successful payments
        if (event === 'order.paid' || event === 'payment.captured') {

            const paymentEntity = parsedBody.payload.payment.entity;
            const targetOrderId = paymentEntity.order_id;
            const targetPaymentId = paymentEntity.id;

            console.log(`💳 Processing logic for Razorpay Order: ${targetOrderId}`);

            // =========================================================================
            // SCENARIO A: MEMBERSHIPS, CARDS, & SERVICES (Stored in paymentModel)
            // =========================================================================
            const paymentDoc = await paymentModel.findOne({ razorpayOrderId: targetOrderId });

            if (paymentDoc) {
                // Idempotency Check
                if (paymentDoc.status === 'Success') {
                    console.log(`ℹ️ Order ${targetOrderId} already processed. Skipping repeat loop.`);
                    return res.status(200).send('ok');
                }

                paymentDoc.status = 'Success';
                await paymentDoc.save();
                console.log(`📝 Unified Payment doc updated to Success for user: ${paymentDoc.userId}`);

                if (paymentDoc.paymentType === 'Membership') {
                    console.log(`🎯 Context matches 'Membership'. Routing flow...`);
                    try {
                        await processPlanActivation(paymentDoc.userId, paymentDoc.metadata?.planId, targetOrderId, targetPaymentId);
                        console.log(`🎁 Activating complimentary Cashback Card now...`);
                        await processCashbackCardActivation(paymentDoc.userId, targetOrderId, targetPaymentId);
                        console.log(`✅ Membership & Cashback Card activated.`);
                    } catch (err) { console.error(`❌ Membership worker error:`, err.message); }
                }
                else if (paymentDoc.paymentType === 'CashbackCard') {
                    console.log(`🎯 Context matches 'CashbackCard'. Routing flow...`);
                    try {
                        await processCashbackCardActivation(paymentDoc.userId, targetOrderId, targetPaymentId);
                        console.log(`✅ Cashback Card successfully activated.`);
                    } catch (err) { console.error(`❌ Cashback Card worker error:`, err.message); }
                }
                else if (paymentDoc.paymentType === 'ServiceBooking') {
                    console.log(`🎯 Context matches 'ServiceBooking'. Routing flow...`);
                    try {
                        await processServiceBooking(paymentDoc.userId, paymentDoc.metadata);
                        console.log(`✅ Service Booking successfully assigned.`);
                    } catch (err) { console.error(`❌ Service Booking worker error:`, err.message); }
                }

                return res.status(200).send('ok'); // Done processing Scenario A
            }


            // =========================================================================
            // SCENARIO B: LOCAL STORE OFFLINE ORDERS (Stored in orderModel)
            // =========================================================================
            const offlineOrders = await orderModel.find({ razorpayOrderId: targetOrderId, status: 'Pending' });

            if (offlineOrders && offlineOrders.length > 0) {
                console.log(`🛍️ Found ${offlineOrders.length} pending Local Store Orders for Razorpay ID: ${targetOrderId}`);

                const orderUserId = offlineOrders[0].user;
                let totalOrderValue = 0;

                // 1. Mark all split orders as Accepted
                for (let order of offlineOrders) {
                    order.status = 'Accepted';
                    await order.save();
                    totalOrderValue += order.totalAmount; // Sum up the true worth of the cart
                }

                // 2. Fetch or Create the User's Cashback Wallet
                let wallet = await cashbackWalletModel.findOne({ userId: orderUserId });
                if (!wallet) {
                    wallet = await cashbackWalletModel.create({ userId: orderUserId, pointsBalance: 0, lifetimePointsEarned: 0 });
                }

                // 3. Deduct Points (If the user burned points during checkout)
                const pointsBurned = offlineOrders[0].pointsUsed || 0;
                if (pointsBurned > 0) {
                    wallet.pointsBalance -= pointsBurned;

                    await cashbackTransactionModel.create({
                        userId: orderUserId,
                        amount: -pointsBurned, // Negative for debit
                        type: 'DEBIT',
                        description: 'Redeemed points for Local Store Purchase',
                        razorpayOrderId: targetOrderId
                    });
                    console.log(`🔥 Deducted ${pointsBurned} points from user ${orderUserId}`);
                }

                // 4. Award 1% Cashback on the total actual value of the items
                const cashbackEarned = Math.floor(totalOrderValue * 0.01); // 1% Hardcoded
                if (cashbackEarned > 0) {
                    wallet.pointsBalance += cashbackEarned;
                    wallet.lifetimePointsEarned += cashbackEarned;

                    await cashbackTransactionModel.create({
                        userId: orderUserId,
                        amount: cashbackEarned, // Positive for credit
                        type: 'CREDIT',
                        description: '1% Cashback for Local Store Purchase',
                        razorpayOrderId: targetOrderId
                    });
                    console.log(`💰 Awarded ₹${cashbackEarned} cashback to user ${orderUserId}`);
                }

                await wallet.save();

                // 5. Clear the User's Offline Cart
                await offlineCartModel.findOneAndDelete({ user: orderUserId });
                console.log(`🛒 Cart cleared for user ${orderUserId}. Store Order processing complete!`);

                return res.status(200).send('ok'); // Done processing Scenario B
            }


            // =========================================================================
            // SCENARIO C: UNKNOWN ORDER
            // =========================================================================
            console.error(`⚠️ No matching order found in ANY database for Razorpay ID: ${targetOrderId}`);
            return res.status(200).send('ok'); // Send 200 so Razorpay stops pinging us
        }

        // Catch-all for non-payment events
        return res.status(200).send('ok');

    } catch (error) {
        console.error("❌ Critical error processing webhook:", error);
        // Returning 500 tells Razorpay to retry this webhook later
        return res.status(500).send('Internal Server Error');
    }
};
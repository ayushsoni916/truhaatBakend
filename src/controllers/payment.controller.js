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
const addressModel = require('../models/store/address.model');

const mongoose = require('mongoose');

// online products
const OnlineOrder = require('../models/store/order.model');
const onlineCartModel = require('../models/store/cart.model');
const onlineProductModel = require('../models/store/product.model');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    // console.log("🔹 createOrder invoked by user:", req.user);
    try {
        const { planId, address } = req.body;
        const userId = req.user.id;

        const stateCode = String(address?.stateCode || '').trim();
        console.log("User ID:", userId, "Plan ID:", planId);
        console.log(req.user)

        if (!planId) {
            return res.status(400).json({ message: "planId is required" });
        }

        // 🔥 NEW: Validate address presence
        if (
            !address?.street?.trim() ||
            !address?.city?.trim() ||
            !address?.state?.trim() ||
            !/^\d{2}$/.test(stateCode) ||
            !/^\d{6}$/.test(String(address?.pincode || '').trim())
        ) {
            return res.status(400).json({
                message: "Complete and valid shipping address is required."
            });
        }

        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) {
            return res.status(400).json({ message: "Invalid or inactive plan configuration" });
        }

        // const calculatedAmount = plan.price;
        const calculatedAmount = 1;

        // Find if exact address exists or create new one
        let userAddress = await addressModel.findOne({
            user: userId,
            addressLine1: address.street.trim(),
            state: address.state.trim(),
            stateCode,
            pincode: address.pincode.trim()
        });

        if (!userAddress) {
            // 🔥 FIX: Pull the actual user document from req.user.doc
            const userDoc = req.user.doc || {};

            // Strong fallbacks using the correct userDoc path
            const safeFirstName = (userDoc.firstName && userDoc.firstName.trim() !== '') ? userDoc.firstName : 'User';
            const safeLastName = (userDoc.lastName && userDoc.lastName.trim() !== '') ? userDoc.lastName : 'Member';
            const safePhone = userDoc.phone || req.user.phone || '0000000000';
            const safeCity = address.city || 'Unknown Area';

            userAddress = await addressModel.create({
                user: userId,
                firstName: safeFirstName,
                lastName: safeLastName,
                phone: safePhone,
                addressLine1: address.street || 'N/A',
                area: safeCity,
                city: safeCity,
                state: address.state || 'N/A',
                stateCode,
                pincode: address.pincode || '000000',
                addressType: 'Home'
            });
        }

        // 1. Create Order in Razorpay
        const options = {
            amount: Math.round(calculatedAmount * 100), // convert to paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            notes: {
                addressId: userAddress._id.toString()
            }
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
                planId: plan._id,
                addressId: userAddress._id.toString()
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

const processOnlineEcommercePayment = async paymentEntity => {
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    const existingOrder = await OnlineOrder.findOne({
        razorpayOrderId
    });

    // Not an online ecommerce payment.
    if (!existingOrder) {
        return { matched: false };
    }

    // Both payment.captured and order.paid can arrive.
    if (existingOrder.paymentStatus === 'PAID') {
        console.log(
            `Online order ${existingOrder.orderId} already processed`
        );

        return {
            matched: true,
            alreadyProcessed: true
        };
    }

    const expectedAmount = Math.round(
        100
        // Number(existingOrder.finalAmount) * 100
    );

    if (Number(paymentEntity.amount) !== expectedAmount) {
        throw new Error(
            `Amount mismatch for online order ${existingOrder.orderId}`
        );
    }

    if (
        String(paymentEntity.currency || '').toUpperCase() !== 'INR'
    ) {
        throw new Error(
            `Currency mismatch for online order ${existingOrder.orderId}`
        );
    }

    if (paymentEntity.status !== 'captured') {
        throw new Error(
            `Payment ${razorpayPaymentId} is not captured`
        );
    }

    const session = await mongoose.startSession();
    let processed = false;

    try {
        await session.withTransaction(async () => {
            /*
             * Only one webhook event can find this order as PENDING.
             * If the transaction retries, reset this value.
             */
            processed = false;

            const order = await OnlineOrder.findOne({
                razorpayOrderId,
                paymentStatus: 'PENDING'
            }).session(session);

            if (!order) {
                return;
            }

            // Reduce stock using the frozen order items.
            for (const item of order.items) {
                const product = await onlineProductModel
                    .findById(item.product)
                    .session(session);

                if (!product) {
                    throw new Error(
                        `Product not found: ${item.product}`
                    );
                }

                const quantity = Number(item.quantity);

                if (product.hasVariants) {
                    const variant = product.variants.find(
                        variantItem =>
                            String(variantItem.size) ===
                            String(item.size)
                    );

                    if (!variant || variant.stock < quantity) {
                        throw new Error(
                            `Insufficient stock for ${item.name}`
                        );
                    }

                    variant.stock -= quantity;

                    product.totalStock = product.variants.reduce(
                        (total, variantItem) =>
                            total + Number(variantItem.stock || 0),
                        0
                    );

                    product.inStock = product.totalStock > 0;
                } else {
                    if (
                        Number(product.totalStock || 0) <
                        quantity
                    ) {
                        throw new Error(
                            `Insufficient stock for ${item.name}`
                        );
                    }

                    product.totalStock -= quantity;
                    product.inStock = product.totalStock > 0;
                }

                await product.save({ session });
            }

            /*
             * Remove only the purchased quantities.
             * Do not delete newly-added cart products.
             */
            const cart = await onlineCartModel
                .findOne({ user: order.user })
                .session(session);

            if (cart) {
                for (const purchasedItem of order.items) {
                    const cartItemIndex = cart.items.findIndex(
                        cartItem =>
                            String(cartItem.product) ===
                            String(purchasedItem.product) &&
                            String(cartItem.size || '') ===
                            String(purchasedItem.size || '')
                    );

                    if (cartItemIndex === -1) {
                        continue;
                    }

                    const remainingQuantity =
                        Number(
                            cart.items[cartItemIndex].quantity
                        ) -
                        Number(purchasedItem.quantity);

                    if (remainingQuantity > 0) {
                        cart.items[cartItemIndex].quantity =
                            remainingQuantity;
                    } else {
                        cart.items.splice(cartItemIndex, 1);
                    }
                }

                // Cart value changed, so remove the old coupon.
                cart.couponCode = null;

                if (cart.items.length === 0) {
                    await onlineCartModel.deleteOne(
                        { _id: cart._id },
                        { session }
                    );
                } else {
                    await cart.save({ session });
                }
            }

            order.paymentStatus = 'PAID';
            order.orderStatus = 'PLACED';
            order.razorpayPaymentId = razorpayPaymentId;
            order.paidAt = new Date();

            if (!order.invoiceNumber) {
                order.invoiceNumber =
                    `INV-${order.orderId}`;
            }

            await order.save({ session });

            processed = true;
        });

        return {
            matched: true,
            processed
        };
    } finally {
        await session.endSession();
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
                        // 🔥 NEW: Extract the addressId from either Razorpay notes or local metadata
                        const razorpayNotes = parsedBody.payload.payment.entity.notes || {};
                        const addressIdToPass = razorpayNotes.addressId || paymentDoc.metadata?.addressId || null;

                        await processPlanActivation(paymentDoc.userId, paymentDoc.metadata?.planId, addressIdToPass, targetOrderId, targetPaymentId);
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
            // SCENARIO B: ONLINE ECOMMERCE ORDER
            // =========================================================================
            const onlineOrderResult =
                await processOnlineEcommercePayment(paymentEntity);

            if (onlineOrderResult.matched) {
                if (onlineOrderResult.processed) {
                    console.log(
                        `Online ecommerce order placed successfully: ${targetOrderId}`
                    );
                } else {
                    console.log(
                        `Online ecommerce order already processed: ${targetOrderId}`
                    );
                }

                return res.status(200).send('ok');
            }


            // =========================================================================
            // SCENARIO C: LOCAL STORE OFFLINE ORDERS (Stored in orderModel)
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

exports.getAllPayments = async (req, res, next) => {
    try {
        // Fetch all gateway payment logs and populate user info
        const payments = await paymentModel.find()
            .populate('userId', 'firstName lastName phone email')
            .sort({ createdAt: -1 });

        // Calculate stats
        let totalCollected = 0;
        let successfulTxns = 0;
        let failedTxns = 0;
        let pendingManual = 0;

        const formattedPayments = payments.map(p => {
            const isSuccess = p.status === 'Success';
            const isFailed = p.status === 'Failed';
            const isPending = p.status === 'Pending';

            if (isSuccess) {
                totalCollected += p.amount;
                successfulTxns++;
            } else if (isFailed) {
                failedTxns++;
            } else if (isPending) {
                pendingManual++;
            }

            return {
                _id: `PAY-${p._id.toString().slice(-6).toUpperCase()}`,
                mongoId: p._id,
                user: {
                    name: p.userId ? `${p.userId.firstName || ''} ${p.userId.lastName || ''}`.trim() : 'Unknown User',
                    phone: p.userId?.phone || 'N/A',
                    email: p.userId?.email || 'N/A'
                },
                amount: p.amount,
                currency: p.currency || 'INR',
                purpose: p.paymentType,
                referenceId: p.metadata?.planId || p.razorpayOrderId,
                paymentMethod: 'Razorpay Gateway',
                gatewayTxnId: p.razorpayOrderId,
                status: p.status.toUpperCase(), // 'SUCCESS', 'FAILED', 'PENDING'
                errorMessage: p.status === 'Failed' ? 'Transaction failed at gateway level.' : null,
                createdAt: p.createdAt,
                completedAt: isSuccess ? p.updatedAt : null
            };
        });

        res.status(200).json({
            success: true,
            stats: {
                totalCollected,
                successfulTxns,
                failedTxns,
                pendingManual
            },
            data: formattedPayments
        });
    } catch (error) {
        console.error("Fetch All Payments Error:", error);
        next(error);
    }
};

exports.verifyManualPayment = async (req, res, next) => {
    try {
        const { paymentId } = req.params; // Mongo _id
        const { status } = req.body; // 'SUCCESS' or 'FAILED'

        const mappedStatus = status === 'SUCCESS' ? 'Success' : 'Failed';

        const paymentDoc = await paymentModel.findByIdAndUpdate(
            paymentId,
            { status: mappedStatus },
            { new: true }
        );

        if (!paymentDoc) {
            return res.status(404).json({ success: false, message: "Payment log not found." });
        }

        res.status(200).json({
            success: true,
            message: `Payment status updated to ${mappedStatus}.`,
            data: paymentDoc
        });
    } catch (error) {
        console.error("Verify Manual Payment Error:", error);
        next(error);
    }
};
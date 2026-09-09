const Razorpay = require('razorpay');
const User = require("../../models/user.model");
const cashbackWalletModel = require("../../models/cashbackWallet.model");
const offlineCartModel = require("../../models/Shop/offlineCart.model");
const orderModel = require("../../models/Shop/order.model");

// Initialize Razorpay 
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.placeOfflineOrder = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { useCashback = false } = req.body || {}; // Passed from frontend checkbox

        // --- 1. GATEKEEPER: Check if user has an active Cashback Card ---
        const user = await User.findById(userId);
        if (!user.hasActiveCashbackCard) {
            return res.status(403).json({
                success: false,
                error: "REQUIRE_CASHBACK_CARD",
                message: "You need an active Cashback Card to place local store orders."
            });
        }

        // --- 2. Fetch the user's offline cart ---
        const cart = await offlineCartModel.findOne({ user: userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: "Your cart is empty." });
        }

        // --- 3. Calculate Base Total ---
        let baseTotal = 0;
        cart.items.forEach(item => {
            const price = item.product.salePrice || item.product.basePrice || item.product.price;
            baseTotal += price * item.quantity;
        });

        // --- 4. Handle Wallet Burn (Cashback Points Discount) ---
        let finalPayable = baseTotal;
        let pointsUsed = 0;

        if (useCashback) {
            const wallet = await cashbackWalletModel.findOne({ userId: userId });
            if (wallet && wallet.pointsBalance > 0) {
                // Use only what is needed, up to the total cart value
                pointsUsed = Math.min(wallet.pointsBalance, baseTotal);
                finalPayable = baseTotal - pointsUsed;
            }
        }

        // --- 5. Create Razorpay Order ---
        // Razorpay requires at least ₹1. If points cover 100% of the cart, set amount to ₹1.
        // const amountForRazorpay = finalPayable < 1 ? 1 : finalPayable;
        const amountForRazorpay = 1; // TODO: REMOVE THIS HARDCODE LATER (Forces ₹1 for testing)

        const options = {
            amount: Math.round(amountForRazorpay * 100), // paise
            currency: "INR",
            receipt: `rcpt_shop_${Date.now()}`,
        };

        const razorOrder = await razorpay.orders.create(options);

        // --- 6. Group items by Shop ID ---
        const ordersByShop = {};
        cart.items.forEach(item => {
            const shopId = item.product.shop.toString();
            if (!ordersByShop[shopId]) {
                ordersByShop[shopId] = [];
            }
            ordersByShop[shopId].push({
                product: item.product._id,
                name: item.product.name,
                price: item.product.salePrice || item.product.basePrice || item.product.price,
                quantity: item.quantity,
                size: item.size || null, // Support for variants
                image: item.product.mainImage?.url || item.product.images?.[0]?.url || ""
            });
        });

        // --- 7. Create separate "Pending" Order documents for each shop ---
        const createdOrderIds = [];

        for (const shopId in ordersByShop) {
            const items = ordersByShop[shopId];
            const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            // Generate your unique human-readable Order ID
            const orderId = `TRU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            await orderModel.create({
                orderId,
                user: userId,
                shop: shopId,
                items: items,
                totalAmount: total,
                status: 'Pending', // Will change to 'Placed' or 'Processing' via Webhook

                // --- NEW FIELDS FOR ADMIN MULTI-VENDOR LEDGER ---
                razorpayOrderId: razorOrder.id,
                pointsUsed: pointsUsed,
                payoutStatus: 'Pending'
            });

            createdOrderIds.push(orderId);
        }

        // NOTE: We DO NOT clear the cart here. We clear it in the Razorpay Webhook!

        // --- 8. Send Razorpay Data to Frontend ---
        res.status(200).json({
            success: true,
            message: "Order initiated.",
            razorpayOrder: {
                id: razorOrder.id,
                amount: razorOrder.amount,
                currency: razorOrder.currency
            },
            internalOrderIds: createdOrderIds
        });

    } catch (error) {
        console.error("Place Offline Order Error:", error);
        next(error);
    }
};
// --- GET USER OFFLINE ORDER HISTORY ---
exports.getOfflineOrderHistory = async (req, res, next) => {
    try {
        const userId = req.user._id;
        console.log(req.user)

        // Fetch orders for this user, populate shop name and logo/image
        const orders = await orderModel.find({ user: userId })
            .populate('shop', 'name images phone address')
            .sort({ createdAt: -1 }); // Newest first

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error("Fetch Order History Error:", error);
        next(error);
    }
};

// ============================================================================
// ADMIN DASHBOARD CONTROLLERS (For your new React UI)
// ============================================================================

// --- GET ALL PLATFORM ORDERS (Admin Ledger) ---
exports.getAllPlatformOrders = async (req, res, next) => {
    try {
        // Fetch all orders globally and populate user & shop details for the table
        const orders = await orderModel.find()
            .populate('user', 'firstName lastName phone email')
            .populate('shop', 'name owner phone')
            .sort({ createdAt: -1 }); // Newest first

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error("Fetch Admin Orders Error:", error);
        next(error);
    }
};

// --- MARK VENDOR PAYOUT AS SETTLED (Admin Ledger) ---
exports.markPayoutSettled = async (req, res, next) => {
    try {
        const { orderId } = req.params; // Expects the Mongo _id of the Order

        const order = await orderModel.findByIdAndUpdate(
            orderId,
            { payoutStatus: 'Settled' },
            { new: true } // Return the updated document
        )
            .populate('user', 'firstName lastName')
            .populate('shop', 'name');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        res.status(200).json({
            success: true,
            message: "Payout marked as settled.",
            data: order
        });
    } catch (error) {
        console.error("Settle Payout Error:", error);
        next(error);
    }
};

// --- GET ORDERS FOR A SPECIFIC SHOP (Shop Dashboard) ---
exports.getOrdersByShopId = async (req, res, next) => {
    try {
        const { shopId } = req.params;

        if (!shopId) {
            return res.status(400).json({ success: false, message: "Shop ID is required." });
        }

        const orders = await orderModel.find({ shop: shopId })
            .populate('user', 'firstName lastName phone email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error("Fetch Shop Orders Error:", error);
        next(error);
    }
};

// --- UPDATE ORDER FULFILLMENT STATUS (Pending -> Accepted -> Ready -> Completed / Cancelled) ---
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['Pending', 'Accepted', 'Ready', 'Completed', 'Cancelled'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid order status." });
        }

        const order = await orderModel.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
        ).populate('user', 'firstName lastName phone email');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}.`,
            data: order
        });
    } catch (error) {
        console.error("Update Order Status Error:", error);
        next(error);
    }
};
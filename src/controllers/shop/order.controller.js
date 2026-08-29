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
        const userId = req.user.id;

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
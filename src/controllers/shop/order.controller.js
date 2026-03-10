const offlineCartModel = require("../../models/Shop/offlineCart.model");
const orderModel = require("../../models/Shop/order.model");


exports.placeOfflineOrder = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Fetch the user's offline cart and populate product & shop details
        const cart = await offlineCartModel.findOne({ user: userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: "Your cart is empty." });
        }

        // 2. Group items by Shop ID
        // This ensures that 1 cart can result in multiple independent orders.
        const ordersByShop = {};

        cart.items.forEach(item => {
            const shopId = item.product.shop.toString();
            if (!ordersByShop[shopId]) {
                ordersByShop[shopId] = [];
            }
            ordersByShop[shopId].push({
                product: item.product._id,
                name: item.product.name,
                price: item.product.salePrice || item.product.price,
                quantity: item.quantity,
                image: item.product.images?.[0]?.url || ""
            });
        });

        // 3. Create separate Order documents for each shop
        const createdOrderIds = [];

        for (const shopId in ordersByShop) {
            const items = ordersByShop[shopId];
            const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            
            // Generate a unique human-readable Order ID
            const orderId = `TRU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const newOrder = await orderModel.create({
                orderId,
                user: userId,
                shop: shopId,
                items: items,
                totalAmount: total,
                status: 'Pending'
            });

            createdOrderIds.push(newOrder.orderId);

            // TODO: Here you would trigger a real-time notification to the shop owner
            console.log(`Order ${orderId} created for Shop ${shopId}`);
        }

        // 4. Clear the Offline Cart after successful placement
        await offlineCartModel.findOneAndDelete({ user: userId });

        res.status(201).json({
            success: true,
            message: `Successfully placed ${createdOrderIds.length} order(s).`,
            orderIds: createdOrderIds
        });

    } catch (error) {
        console.error("Place Order Error:", error);
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
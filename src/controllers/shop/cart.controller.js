const offlineCartModel = require("../../models/Shop/offlineCart.model");

const calculateOfflineSummary = (items) => {
    let subtotal = 0;
    const formattedItems = items.map(item => {
        const product = item.product;
        const price = product.salePrice || product.price;
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        return {
            _id: item._id,
            productId: product._id,
            name: product.name,
            image: product.images?.[0]?.url || "",
            price: price,
            originalPrice: product.price,
            quantity: item.quantity,
            itemTotal: itemTotal
        };
    });

    return {
        items: formattedItems,
        summary: {
            subtotal: subtotal,
            total: subtotal // No shipping/coupons for offline
        }
    };
};// --- 1. Get Cart ---
exports.getOfflineCart = async (req, res, next) => {
    try {
        const cart = await offlineCartModel.findOne({ user: req.user.id }).populate('items.product');
        if (!cart) return res.status(200).json({ success: true, data: { items: [], summary: { subtotal: 0, total: 0 } } });

        const data = calculateOfflineSummary(cart.items);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};



// --- 2. Add to Cart ---
exports.addToOfflineCart = async (req, res, next) => {
    try {
        const { productId, quantity = 1 } = req.body;
        let cart = await offlineCartModel.findOne({ user: req.user.id });

        if (!cart) cart = new offlineCartModel({ user: req.user.id, items: [] });

        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity });
        }

        await cart.save();
        res.status(200).json({ success: true, message: "Added to cart" });
    } catch (error) { next(error); }
};


// --- 3. Update Item (increment, decrement, remove) ---
exports.updateOfflineCartItem = async (req, res, next) => {
    try {
        const { productId, type } = req.body; // type: 'increment', 'decrement', 'remove'
        const cart = await offlineCartModel.findOne({ user: req.user.id });

        if (!cart) return res.status(404).json({ error: "Cart not found" });

        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
        if (itemIndex === -1) return res.status(404).json({ error: "Item not in cart" });

        if (type === 'increment') {
            cart.items[itemIndex].quantity += 1;
        } else if (type === 'decrement') {
            if (cart.items[itemIndex].quantity > 1) cart.items[itemIndex].quantity -= 1;
        } else if (type === 'remove') {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();

        // Re-fetch with population to send fresh summary
        const updatedCart = await offlineCartModel.findById(cart._id).populate('items.product');
        const data = calculateOfflineSummary(updatedCart.items);

        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
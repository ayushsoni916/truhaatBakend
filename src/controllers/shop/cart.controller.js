const offlineCartModel = require("../../models/Shop/offlineCart.model");
const cashbackWalletModel = require("../../models/cashbackWallet.model");

const calculateOfflineSummary = (items) => {
    let subtotal = 0;
    const formattedItems = items.map(item => {
        const product = item.product;
        // Correct pricing extraction based on your new schema
        const originalPrice = product.basePrice || product.price;
        const price = product.salePrice || originalPrice;

        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        // Smart image fallback
        const image = product.mainImage?.url || product.images?.[0]?.url || product.image || "https://via.placeholder.com/150";

        return {
            _id: item._id,
            productId: product._id,
            name: product.name,
            image: image,
            price: price,
            originalPrice: originalPrice,
            quantity: item.quantity,
            itemTotal: itemTotal,
            size: item.size || null, // Capture variant size if it exists
            shop: product.shop // Passed down via populate
        };
    });

    return {
        items: formattedItems,
        summary: {
            subtotal: subtotal,
            total: subtotal
        }
    };
};

// --- 1. Get Cart ---
// --- 1. Get Cart ---
exports.getOfflineCart = async (req, res, next) => {
    try {
        const cart = await offlineCartModel.findOne({ user: req.user.id })
            .populate({
                path: 'items.product',
                populate: { path: 'shop', select: 'name' }
            });

        // NEW: Fetch user's cashback balance (default to 0 if wallet doesn't exist yet)
        const wallet = await cashbackWalletModel.findOne({ userId: req.user.id });
        const availablePoints = wallet ? wallet.pointsBalance : 0;

        if (!cart) {
            return res.status(200).json({
                success: true,
                data: { items: [], summary: { subtotal: 0, total: 0 } },
                cashbackBalance: availablePoints // Send balance even if cart is empty
            });
        }

        const data = calculateOfflineSummary(cart.items);
        res.status(200).json({
            success: true,
            data,
            cashbackBalance: availablePoints // Send balance with cart data
        });
    } catch (error) { next(error); }
};

// --- 2. Add to Cart (Upgraded for Variants) ---
exports.addToOfflineCart = async (req, res, next) => {
    try {
        const { productId, quantity = 1, size } = req.body;
        let cart = await offlineCartModel.findOne({ user: req.user.id });

        if (!cart) cart = new offlineCartModel({ user: req.user.id, items: [] });

        // Match by both product ID AND Size (so L and XL don't merge into one item)
        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId && p.size === size);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity, size });
        }

        await cart.save();
        res.status(200).json({ success: true, message: "Added to cart" });
    } catch (error) { next(error); }
};

// --- 3. Update Item ---
exports.updateOfflineCartItem = async (req, res, next) => {
    try {
        const { productId, size, type } = req.body;
        const cart = await offlineCartModel.findOne({ user: req.user.id });

        if (!cart) return res.status(404).json({ error: "Cart not found" });

        const itemIndex = cart.items.findIndex(p => p.product.toString() === productId && p.size === size);
        if (itemIndex === -1) return res.status(404).json({ error: "Item not in cart" });

        if (type === 'increment') {
            cart.items[itemIndex].quantity += 1;
        } else if (type === 'decrement') {
            if (cart.items[itemIndex].quantity > 1) cart.items[itemIndex].quantity -= 1;
        } else if (type === 'remove') {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();

        const updatedCart = await offlineCartModel.findById(cart._id)
            .populate({ path: 'items.product', populate: { path: 'shop', select: 'name' } });

        const data = calculateOfflineSummary(updatedCart.items);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
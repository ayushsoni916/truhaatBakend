const offlineCartModel = require("../../models/Shop/offlineCart.model");
const cashbackWalletModel = require("../../models/cashbackWallet.model");
const shopProductModel =
    require("../../models/Shop/product.model");

const round2 = value =>
    Number(Number(value || 0).toFixed(2));

const calculateOfflineSummary = items => {
    let subtotal = 0;

    const formattedItems = items
        .filter(item => item.product)
        .map(item => {
            const product = item.product;

            const basePrice = Number(product.basePrice || 0);
            const salePrice = Number(product.salePrice);
            const gstPercentage = Number(product.gstPercentage || 0);

            const hasDiscount =
                Number.isFinite(salePrice) &&
                salePrice > 0 &&
                salePrice < basePrice;

            const sellingPriceBeforeGst = hasDiscount
                ? salePrice
                : basePrice;

            const originalFinalPrice = round2(
                basePrice * (1 + gstPercentage / 100)
            );

            const finalPrice = round2(
                sellingPriceBeforeGst *
                (1 + gstPercentage / 100)
            );

            const discountPercentage =
                hasDiscount && basePrice > 0
                    ? Math.round(
                        ((basePrice - salePrice) / basePrice) * 100
                    )
                    : 0;

            const itemTotal = round2(
                finalPrice * item.quantity
            );

            subtotal = round2(subtotal + itemTotal);

            return {
                _id: item._id,
                productId: product._id,
                name: product.name,
                image:
                    product.mainImage?.url ||
                    product.images?.[0]?.url ||
                    product.image ||
                    null,

                quantity: item.quantity,
                size: item.size || null,
                shop: product.shop,

                finalPrice,
                originalFinalPrice,
                discountPercentage,
                itemTotal,

                hasVariants: Boolean(product.hasVariants),

                variants: (product.variants || []).map(variant => ({
                    size: variant.size,
                    color: variant.color || '',
                    stock: Number(variant.stock || 0)
                })),
            };
        });

    return {
        items: formattedItems,
        summary: {
            subtotal,
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
exports.updateOfflineCartItem = async (
    req,
    res,
    next
) => {
    try {
        const { productId, size, type } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                error: "Product ID is required"
            });
        }

        if (
            !['increment', 'decrement', 'remove']
                .includes(type)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid update type"
            });
        }

        const normalizedSize = size
            ? String(size).trim()
            : null;

        const cart = await offlineCartModel.findOne({
            user: req.user.id
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: "Cart not found"
            });
        }

        const itemIndex = cart.items.findIndex(
            item =>
                item.product.toString() ===
                String(productId) &&
                (item.size || null) === normalizedSize
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Item not found in cart"
            });
        }

        const cartItem = cart.items[itemIndex];

        if (type === 'increment') {
            const product =
                await shopProductModel.findById(productId);

            if (
                !product ||
                !product.isActive ||
                product.adminDisabled
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Product is currently unavailable"
                });
            }

            let availableStock = 0;

            if (product.hasVariants) {
                const variant = product.variants.find(
                    item =>
                        String(item.size) ===
                        String(normalizedSize)
                );

                if (!variant) {
                    return res.status(400).json({
                        success: false,
                        error: "Selected variant is unavailable"
                    });
                }

                availableStock = Number(
                    variant.stock || 0
                );
            } else {
                availableStock = Number(
                    product.totalStock || 0
                );
            }

            if (cartItem.quantity >= availableStock) {
                return res.status(400).json({
                    success: false,
                    error: `Only ${availableStock} units are available`
                });
            }

            cartItem.quantity += 1;
        }

        if (
            type === 'decrement' &&
            cartItem.quantity > 1
        ) {
            cartItem.quantity -= 1;
        }

        if (type === 'remove') {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();

        const updatedCart =
            await offlineCartModel
                .findById(cart._id)
                .populate({
                    path: 'items.product',
                    populate: {
                        path: 'shop',
                        select: 'name'
                    }
                });

        const data = calculateOfflineSummary(
            updatedCart.items
        );

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

exports.changeOfflineCartVariant = async (
    req,
    res,
    next
) => {
    try {
        const {
            productId,
            oldSize,
            newSize
        } = req.body;

        const normalizedOldSize = oldSize
            ? String(oldSize).trim()
            : null;

        const normalizedNewSize = newSize
            ? String(newSize).trim()
            : null;

        if (
            !productId ||
            !normalizedNewSize
        ) {
            return res.status(400).json({
                success: false,
                error: "Product and new size are required"
            });
        }

        const cart = await offlineCartModel.findOne({
            user: req.user.id
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: "Cart not found"
            });
        }

        const oldItemIndex = cart.items.findIndex(
            item =>
                item.product.toString() ===
                String(productId) &&
                (item.size || null) ===
                normalizedOldSize
        );

        if (oldItemIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Cart item not found"
            });
        }

        const product =
            await shopProductModel.findById(productId);

        if (
            !product ||
            !product.isActive ||
            product.adminDisabled
        ) {
            return res.status(400).json({
                success: false,
                error: "Product is unavailable"
            });
        }

        const newVariant = product.variants.find(
            variant =>
                String(variant.size) ===
                normalizedNewSize
        );

        if (!newVariant) {
            return res.status(400).json({
                success: false,
                error: "Selected variant is unavailable"
            });
        }

        const currentQuantity =
            cart.items[oldItemIndex].quantity;

        const existingNewItemIndex =
            cart.items.findIndex(
                item =>
                    item.product.toString() ===
                    String(productId) &&
                    (item.size || null) ===
                    normalizedNewSize
            );

        const combinedQuantity =
            existingNewItemIndex !== -1
                ? cart.items[existingNewItemIndex]
                    .quantity + currentQuantity
                : currentQuantity;

        if (
            combinedQuantity >
            Number(newVariant.stock || 0)
        ) {
            return res.status(400).json({
                success: false,
                error: `Only ${newVariant.stock} units are available`
            });
        }

        if (existingNewItemIndex !== -1) {
            cart.items[existingNewItemIndex]
                .quantity = combinedQuantity;

            cart.items.splice(oldItemIndex, 1);
        } else {
            cart.items[oldItemIndex].size =
                normalizedNewSize;
        }

        await cart.save();

        const updatedCart =
            await offlineCartModel
                .findById(cart._id)
                .populate({
                    path: 'items.product',
                    populate: {
                        path: 'shop',
                        select: 'name'
                    }
                });

        return res.status(200).json({
            success: true,
            data: calculateOfflineSummary(
                updatedCart.items
            )
        });
    } catch (error) {
        next(error);
    }
};
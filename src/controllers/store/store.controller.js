const cartModel = require('../../models/store/cart.model');
const addressModel = require('../../models/store/address.model');
const couponModel = require('../../models/store/coupon.model');
const Order = require('../../models/store/order.model');

// Helper: Calculate Cart Totals
const calculateCartTotals = async (cartItems, couponCode) => {
    let subtotal = 0;
    let itemsFormatted = [];

    // 1. Calculate Subtotal from Live Product Data
    for (const item of cartItems) {
        // item.product is already populated
        const product = item.product;

        // Safety check: if product was deleted from DB
        if (!product) continue;

        const price = product.salePrice || product.price;
        const itemTotal = price * item.quantity;

        subtotal += itemTotal;

        itemsFormatted.push({
            product: product._id,
            name: product.name,
            image: product.mainImage,
            price: price,
            originalPrice: product.price, // To show strikethrough price
            quantity: item.quantity,
            size: item.size,
            itemTotal: itemTotal
        });
    }

    // 2. Calculate Discount (Coupon)
    let discount = 0;
    let couponDetails = null;

    if (couponCode) {
        const coupon = await couponModel.findOne({ code: couponCode, isActive: true });

        // Validate Coupon
        if (coupon && new Date() < coupon.expiresAt && subtotal >= coupon.minOrderValue) {

            if (coupon.discountType === 'PERCENTAGE') {
                discount = (subtotal * coupon.value) / 100;
                if (coupon.maxDiscountAmount) {
                    discount = Math.min(discount, coupon.maxDiscountAmount);
                }
            } else { // FLAT
                discount = coupon.value;
            }
            couponDetails = { code: coupon.code, discount: discount };
        }
    }

    const shipping = subtotal > 500 ? 0 : 40; // Example: Free shipping over 500
    const finalAmount = subtotal - discount + shipping;

    return {
        items: itemsFormatted,
        subtotal,
        discount,
        shipping,
        finalAmount,
        couponDetails
    };
};

// ==========================================
// CART CONTROLLERS
// ==========================================

exports.addToCart = async (req, res, next) => {
    try {
        // console.log("req",req)
        const { productId, quantity, size } = req.body;
        console.log("productId", productId, "quantity", quantity, "size", size)
        const userId = req.user.id;

        let cart = await cartModel.findOne({ user: userId });
        if (!cart) {
            cart = new cartModel({ user: userId, items: [] });
        }

        // Check if product+size exists
        const targetSize = size ? String(size) : null;

        // Check if product+size exists
        const itemIndex = cart.items.findIndex(p => {
            // Convert DB ObjectId to string
            const dbProduct = p.product.toString();
            // Convert DB size to string (safe check)
            const dbSize = p.size ? String(p.size) : null;

            return dbProduct === productId && dbSize === targetSize;
        });
        // --

        console.log("itemIdx", itemIndex)
        console.log("cart", cart)

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity, size });
        }

        await cart.save();
        // console.log("cart Updated")
        // console.log("new cart",cart)
        res.status(200).json({ success: true, message: 'Updated cart' });
    } catch (error) {
        console.log("error", error)
        next(error);
    }
};

exports.getCart = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const cart = await cartModel.findOne({ user: userId }).populate('items.product');
        // console.log("cart->",cart)
        if (!cart) {
            return res.status(200).json({ success: true, data: { items: [], summary: {} } });
        }

        // LIVE CALCULATION
        const calculation = await calculateCartTotals(cart.items, cart.couponCode);

        // If coupon code exists in DB but calculation says it's invalid (null details), remove it.
        if (cart.couponCode && !calculation.couponDetails) {
            cart.couponCode = null;
            await cart.save();
        }

        res.status(200).json({
            success: true,
            data: {
                items: calculation.items,
                summary: {
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    shipping: calculation.shipping,
                    total: calculation.finalAmount,
                    coupon: calculation.couponDetails
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.removeCartItem = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;
        const { size } = req.query; // Optional: delete specific size

        const cart = await cartModel.findOne({ user: userId });
        if (!cart) return res.status(404).json({ error: 'Cart not found' });

        // Filter logic:
        // If size is provided, keep items that DON'T match (Product + Size)
        // If size is NOT provided, remove ALL instances of that Product
        cart.items = cart.items.filter(item => {
            const isSameProduct = item.product.toString() === productId;

            if (isSameProduct) {
                // If user specified a size to delete, strictly match it
                if (size) {
                    return item.size !== size; // Keep if size is different
                }
                // If no size specified, delete this product (return false)
                return false;
            }
            return true; // Keep other products
        });

        // --- FIX: Explicitly clear coupon if cart becomes empty ---
        if (cart.items.length === 0) {
            cart.couponCode = null;
        }

        await cart.save();
        // 2. RE-FETCH & RE-CALCULATE (To return fresh summary)
        // We populate again because calculateCartTotals likely needs product details (price)
        const updatedCart = await cartModel.findOne({ user: userId }).populate('items.product');

        const calculation = await calculateCartTotals(updatedCart.items, updatedCart.couponCode);

        // --- FIX: Auto-remove if total dropped below min value ---
        if (updatedCart.couponCode && !calculation.couponDetails) {
            updatedCart.couponCode = null;
            await updatedCart.save();
        }

        // 3. Return the same structure as 'getCart'
        res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: {
                items: calculation.items,
                summary: {
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    shipping: calculation.shipping,
                    total: calculation.finalAmount,
                    coupon: calculation.couponDetails
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.updateCartItem = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId, size, type } = req.body; // Using productId + size to identify

        // 1. Get Cart
        let cart = await cartModel.findOne({ user: userId });
        if (!cart) return res.status(404).json({ error: "Cart not found" });

        // 2. Find the item index by ProductID AND Size
        // We cast p.product to string to ensure matching works
        const itemIndex = cart.items.findIndex(p =>
            p.product.toString() === productId && p.size === size
        );

        if (itemIndex === -1) {
            return res.status(404).json({ error: "Item not found in cart" });
        }

        // 3. Update Quantity
        if (type === 'increment') {
            cart.items[itemIndex].quantity += 1;
        } else if (type === 'decrement') {
            if (cart.items[itemIndex].quantity > 1) {
                cart.items[itemIndex].quantity -= 1;
            } else {
                return res.status(400).json({ error: "Quantity cannot be less than 1" });
            }
        }

        await cart.save();

        // 4. Recalculate & Return
        const updatedCart = await cartModel.findOne({ user: userId }).populate('items.product');
        const calculation = await calculateCartTotals(updatedCart.items, updatedCart.couponCode);

        // --- FIX: Auto-remove if total dropped below min value ---
        if (updatedCart.couponCode && !calculation.couponDetails) {
            updatedCart.couponCode = null;
            await updatedCart.save();
        }

        res.status(200).json({
            success: true,
            message: "Cart updated",
            data: {
                items: calculation.items,
                summary: {
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    shipping: calculation.shipping,
                    total: calculation.finalAmount,
                    coupon: calculation.couponDetails
                }
            }
        });

    } catch (error) {
        next(error);
    }
};



// ==========================================
// COUPON CONTROLLER
// ==========================================

// --- 1. Create Coupon (Admin) ---
exports.createCoupon = async (req, res, next) => {
    try {
        const {
            code,
            description,
            discountType,
            value,
            minOrderValue,
            maxDiscountAmount,
            expiresAt
        } = req.body;

        // Check if exists
        const exists = await couponModel.findOne({ code: code.toUpperCase() });
        if (exists) return res.status(400).json({ error: 'Coupon code already exists' });

        const coupon = await couponModel.create({
            code,
            description,
            discountType,
            value,
            minOrderValue,
            maxDiscountAmount,
            expiresAt
        });

        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        next(error);
    }
};

// --- 2. Get All Active Coupons (User) ---
exports.getCoupons = async (req, res, next) => {
    try {
        const today = new Date();

        // Fetch active coupons that haven't expired
        const coupons = await couponModel.find({
            isActive: true,
            expiresAt: { $gt: today }
        }).sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        next(error);
    }
};

exports.applyCoupon = async (req, res, next) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        // 1. Validate Coupon Exists & Active
        const coupon = await couponModel.findOne({
            code: code.toUpperCase(),
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({ error: 'Invalid or expired coupon code' });
        }

        // 2. Find Cart to check Subtotal
        const cart = await cartModel.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // 3. Calculate Subtotal
        let subtotal = 0;
        for (const item of cart.items) {
            if (item.product) {
                const price = item.product.salePrice || item.product.price;
                subtotal += price * item.quantity;
            }
        }

        // 4. Check Minimum Order Value
        if (subtotal < coupon.minOrderValue) {
            return res.status(400).json({
                error: `Coupon requires a minimum order of ₹${coupon.minOrderValue}`
            });
        }

        // 5. Success: Save Code to Cart
        cart.couponCode = coupon.code;
        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            code: coupon.code
        });

    } catch (error) {
        next(error);
    }
};

// ==========================================
// ORDER CONTROLLER
// ==========================================

exports.placeOrder = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { addressId, paymentMode } = req.body;

        const cart = await cartModel.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

        const address = await addressModel.findById(addressId);
        if (!address) return res.status(404).json({ error: 'Address not found' });

        // RE-CALCULATE EVERYTHING SECURELY
        const calculation = await calculateCartTotals(cart.items, cart.couponCode);

        // Generate Order ID
        const orderId = 'ORD-' + Date.now();

        const newOrder = await Order.create({
            orderId,
            user: userId,
            items: calculation.items, // Snapshot of items with name, price, size
            shippingAddress: address.toObject(),
            paymentMode,
            subtotal: calculation.subtotal,
            discount: calculation.discount,
            shippingFee: calculation.shipping,
            finalAmount: calculation.finalAmount,
            couponApplied: calculation.couponDetails ? calculation.couponDetails.code : null
        });

        // Clear Cart
        await cartModel.findOneAndDelete({ user: userId });

        res.status(201).json({ success: true, orderId: newOrder.orderId });
    } catch (error) {
        next(error);
    }
};

// --- 1. Get List of All Orders for a User ---
exports.getUserOrders = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Fetch orders, sort by newest first
        const orders = await Order.find({ user: userId })
            .select('orderId createdAt status finalAmount items') // Select only necessary fields for the list
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

// --- 2. Get Single Order Details (The Bill/Invoice View) ---
exports.getOrderDetails = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;

        // Find specific order by orderId (e.g., ORD-12345) and ensure it belongs to the user
        const order = await Order.findOne({
            orderId: orderId,
            user: userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Return a structure similar to getCart summary for UI consistency
        res.status(200).json({
            success: true,
            data: {
                orderInfo: {
                    id: order.orderId,
                    date: order.createdAt,
                    status: order.status || "Pending",
                    paymentMode: order.paymentMode,
                    paymentStatus: order.paymentStatus
                },
                items: order.items, // This contains the snapshot (name, price, qty, image)
                shippingAddress: order.shippingAddress,
                summary: {
                    subtotal: order.subtotal,
                    discount: order.discount,
                    shipping: order.shippingFee,
                    total: order.finalAmount,
                    coupon: order.couponApplied
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// Address CONTROLLER
// ==========================================

exports.addAddress = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Destructure to ensure we only save valid fields
        const {
            firstName, lastName, phone,
            addressLine1, addressLine2,
            area, city, state, pincode,
            addressType, isDefault
        } = req.body;

        // Optional: If this is set as default, unset previous default
        if (isDefault) {
            await addressModel.updateMany(
                { user: userId },
                { isDefault: false }
            );
        }

        const address = await addressModel.create({
            user: userId,
            firstName,
            lastName,
            phone,
            addressLine1,
            addressLine2,
            area,
            city,
            state,
            pincode,
            addressType,
            isDefault: isDefault || false
        });

        res.status(201).json({ success: true, data: address });

    } catch (error) {
        next(error);
    }
};

exports.getAddresses = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Sort by default first, then newest
        const addresses = await addressModel.find({ user: userId })
            .sort({ isDefault: -1, createdAt: -1 });

        res.status(200).json({ success: true, data: addresses });

    } catch (error) {
        next(error);
    }
};

exports.getDefaultAddress = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Try to find the one marked as default
        let address = await addressModel.findOne({ user: userId, isDefault: true });

        // 2. If no default exists, try to get the most recent one
        if (!address) {
            address = await addressModel.findOne({ user: userId }).sort({ createdAt: -1 });
        }

        // Returns the address object OR null if user has 0 addresses
        res.status(200).json({ success: true, data: address });

    } catch (error) {
        next(error);
    }
};
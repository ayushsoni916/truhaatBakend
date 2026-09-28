const cartModel = require('../../models/store/cart.model');
const addressModel = require('../../models/store/address.model');
const couponModel = require('../../models/store/coupon.model');
const Order = require('../../models/store/order.model');
const productModel = require('../../models/store/product.model');

const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const round2 = value => Number(Number(value).toFixed(2));

// Helper: Calculate Cart Totals
const calculateCartTotals = async (cartItems, couponCode) => {
    let subtotal = 0;
    let itemsFormatted = [];

    // 1. Calculate Subtotal from Live Product Data
    for (const item of cartItems) {
        const product = item.product;

        // Safety check: if product was deleted from DB
        if (!product) continue;

        // NEW: Use basePrice and salePrice from the new schema
        // const price = product.salePrice || product.basePrice;
        // const itemTotal = price * item.quantity;

        // subtotal += itemTotal;
        const hasSalePrice =
            product.salePrice !== null &&
            product.salePrice !== undefined &&
            Number(product.salePrice) > 0 &&
            Number(product.salePrice) < Number(product.basePrice);

        const priceBeforeGst = hasSalePrice
            ? Number(product.salePrice)
            : Number(product.basePrice);

        const gstPercentage = Number(product.gstPercentage || 0);

        const finalPrice = Number(
            (
                priceBeforeGst *
                (1 + gstPercentage / 100)
            ).toFixed(2)
        );

        const originalFinalPrice = Number(
            (
                Number(product.basePrice) *
                (1 + gstPercentage / 100)
            ).toFixed(2)
        );

        const discountPercentage = hasSalePrice
            ? Math.round(
                (
                    (product.basePrice - product.salePrice) /
                    product.basePrice
                ) * 100
            )
            : 0;

        const itemTotal = Number(
            (finalPrice * item.quantity).toFixed(2)
        );

        subtotal += itemTotal;

        // NEW: Determine max available stock for this specific cart item
        let maxStock = 0;
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            const variant = product.variants.find(v => String(v.size) === String(item.size));
            maxStock = variant ? variant.stock : 0;
        } else {
            maxStock = product.totalStock || 0;
        }

        itemsFormatted.push({
            product: product._id,
            name: product.name,
            image: product.mainImage?.url || product.mainImage,

            price: finalPrice,
            originalPrice: originalFinalPrice,

            finalPrice,
            originalFinalPrice,
            discountPercentage,

            quantity: item.quantity,
            size: item.size,
            maxStock,
            itemTotal,

            hasVariants: product.hasVariants,
            variants: product.variants || []
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

    const shipping = subtotal > 500 ? 0 : 40;
    // const finalAmount = subtotal - discount + shipping;
    const finalAmount = Number(
        (subtotal - discount + shipping).toFixed(2)
    );

    return {
        items: itemsFormatted,
        subtotal,
        discount,
        shipping,
        finalAmount,
        couponDetails
    };
};

const returnExistingCheckout = (res, order) => {
    if (order.paymentStatus === 'PAID') {
        return res.status(200).json({
            success: true,
            alreadyPaid: true,
            data: {
                localOrderId: order._id,
                orderId: order.orderId,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus
            }
        });
    }

    if (order.paymentStatus === 'FAILED') {
        return res.status(409).json({
            success: false,
            message: 'Previous checkout failed. Start a new checkout.'
        });
    }

    // Another identical request is currently creating the Razorpay order.
    if (!order.razorpayOrderId) {
        return res.status(202).json({
            success: false,
            processing: true,
            message: 'Checkout is being initialized. Please retry.'
        });
    }

    return res.status(200).json({
        success: true,
        reused: true,
        data: {
            localOrderId: order._id,
            orderId: order.orderId,
            razorpayOrderId: order.razorpayOrderId,
            amount: Math.round(order.finalAmount * 100),
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID
        }
    });
};

// ==========================================
// CART CONTROLLERS
// ==========================================

exports.addToCart = async (req, res, next) => {
    try {
        const { productId, quantity, size } = req.body;
        const userId = req.user.id;

        // --- NEW: STOCK VALIDATION ---
        const product = await productModel.findById(productId);
        if (!product) return res.status(404).json({ error: "Product not found" });

        // Determine available stock
        let availableStock = 0;
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            const targetVariant = product.variants.find(v => String(v.size) === String(size));
            if (!targetVariant) return res.status(400).json({ error: "Selected variant is unavailable." });
            availableStock = targetVariant.stock;
        } else {
            availableStock = product.totalStock || 0;
        }

        if (availableStock < 1) {
            return res.status(400).json({ error: "This item is currently out of stock." });
        }
        // -----------------------------

        let cart = await cartModel.findOne({ user: userId });
        if (!cart) {
            cart = new cartModel({ user: userId, items: [] });
        }

        const targetSize = size ? String(size) : null;

        const itemIndex = cart.items.findIndex(p => {
            const dbProduct = p.product.toString();
            const dbSize = p.size ? String(p.size) : null;
            return dbProduct === productId && dbSize === targetSize;
        });

        // Check if new quantity exceeds stock
        const currentCartQty = itemIndex > -1 ? cart.items[itemIndex].quantity : 0;
        if (currentCartQty + quantity > availableStock) {
            return res.status(400).json({
                error: `Only ${availableStock} units available. You already have ${currentCartQty} in your cart.`
            });
        }

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity, size });
        }

        await cart.save();
        res.status(200).json({ success: true, message: 'Added to cart' });
    } catch (error) {
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
        const { productId, size, type } = req.body;

        let cart = await cartModel.findOne({ user: userId });
        if (!cart) return res.status(404).json({ error: "Cart not found" });

        const itemIndex = cart.items.findIndex(p =>
            p.product.toString() === productId && p.size === size
        );

        if (itemIndex === -1) {
            return res.status(404).json({ error: "Item not found in cart" });
        }

        // --- NEW: STOCK VALIDATION FOR INCREMENT ---
        if (type === 'increment') {
            const product = await productModel.findById(productId);
            let availableStock = product.totalStock || 0;

            if (product.hasVariants && product.variants) {
                const variant = product.variants.find(v => String(v.size) === String(size));
                if (variant) availableStock = variant.stock;
            }

            if (cart.items[itemIndex].quantity + 1 > availableStock) {
                return res.status(400).json({ error: `Maximum stock limit reached (${availableStock}).` });
            }

            cart.items[itemIndex].quantity += 1;
        }
        else if (type === 'decrement') {
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
// --- Get ALL Coupons for Admin Dashboard (Ignores Expiry) ---
exports.getAllCouponsAdmin = async (req, res, next) => {
    try {
        const coupons = await couponModel.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        next(error);
    }
};

// --- Delete a Coupon ---
exports.deleteCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedCoupon = await couponModel.findByIdAndDelete(id);

        if (!deletedCoupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// --- Toggle Coupon Active Status (Optional but useful) ---
exports.toggleCouponStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const coupon = await couponModel.findById(id);

        if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.status(200).json({ success: true, message: 'Coupon status updated', data: coupon });
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

exports.createOnlineOrder = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { addressId, checkoutId } = req.body;

        if (!addressId || !checkoutId?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'addressId and checkoutId are required'
            });
        }

        const safeCheckoutId = checkoutId.trim();

        // Idempotency: retry returns the same checkout.
        const existingOrder = await Order.findOne({
            user: userId,
            checkoutId: safeCheckoutId
        });

        if (existingOrder) {
            return returnExistingCheckout(res, existingOrder);
        }

        const [cart, address] = await Promise.all([
            cartModel
                .findOne({ user: userId })
                .populate('items.product'),

            addressModel.findOne({
                _id: addressId,
                user: userId
            })
        ]);

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        const stateCode = String(address.stateCode || '').trim();

        if (!/^\d{2}$/.test(stateCode)) {
            return res.status(400).json({
                success: false,
                message: 'Valid address state code is required'
            });
        }

        const isRajasthan = stateCode === '08';

        // Validate product availability and stock again.
        for (const cartItem of cart.items) {
            const product = cartItem.product;
            const quantity = Number(cartItem.quantity);

            if (!product || !product.isActive || !product.inStock) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more products are unavailable'
                });
            }

            if (!Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid quantity for ${product.name}`
                });
            }

            if (product.hasVariants) {
                const variant = product.variants.find(
                    variantItem =>
                        String(variantItem.size) === String(cartItem.size)
                );

                if (!variant || Number(variant.stock) < quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.name}`
                    });
                }
            } else if (Number(product.totalStock || 0) < quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}`
                });
            }
        }

        // Use the same calculation as the cart screen.
        const calculation = await calculateCartTotals(
            cart.items,
            cart.couponCode
        );

        if (cart.couponCode && !calculation.couponDetails) {
            return res.status(400).json({
                success: false,
                message: 'Coupon is no longer valid. Refresh the cart.'
            });
        }

        const subtotal = round2(calculation.subtotal);
        const discount = round2(calculation.discount);
        const shippingFee = round2(calculation.shipping);
        const handlingFee = 0;
        const finalAmount = round2(calculation.finalAmount);

        /*
         * Allocate the coupon discount proportionately between products.
         * This gives the correct taxable value and GST after discount.
         */
        let allocatedDiscount = 0;

        const orderItems = cart.items.map((cartItem, index) => {
            const product = cartItem.product;
            const quantity = Number(cartItem.quantity);

            const basePrice = Number(product.basePrice);
            const salePrice = Number(product.salePrice);

            const hasSalePrice =
                Number.isFinite(salePrice) &&
                salePrice > 0 &&
                salePrice < basePrice;

            // GST-exclusive selling price per unit.
            const priceBeforeGst = hasSalePrice
                ? salePrice
                : basePrice;

            const gstPercentage = Number(
                product.gstPercentage || 0
            );

            const finalUnitPrice = round2(
                priceBeforeGst * (1 + gstPercentage / 100)
            );

            const grossLineTotal = round2(
                finalUnitPrice * quantity
            );

            const isLastItem =
                index === cart.items.length - 1;

            const lineDiscount = discount === 0
                ? 0
                : isLastItem
                    ? round2(discount - allocatedDiscount)
                    : round2(
                        discount *
                        (grossLineTotal / subtotal)
                    );

            allocatedDiscount = round2(
                allocatedDiscount + lineDiscount
            );

            const totalAmount = round2(
                grossLineTotal - lineDiscount
            );

            const taxableValue = round2(
                totalAmount /
                (1 + gstPercentage / 100)
            );

            const gstAmount = round2(
                totalAmount - taxableValue
            );

            let cgstRate = 0;
            let sgstRate = 0;
            let igstRate = 0;

            let cgstAmount = 0;
            let sgstAmount = 0;
            let igstAmount = 0;

            if (isRajasthan) {
                cgstRate = gstPercentage / 2;
                sgstRate = gstPercentage / 2;

                cgstAmount = round2(gstAmount / 2);
                sgstAmount = round2(
                    gstAmount - cgstAmount
                );
            } else {
                igstRate = gstPercentage;
                igstAmount = gstAmount;
            }

            return {
                product: product._id,
                name: product.name,
                image:
                    product.mainImage?.url ||
                    product.mainImage ||
                    '',
                quantity,
                size: cartItem.size || null,

                hsnCode: product.hsnCode,
                gstPercentage,

                price: priceBeforeGst,
                taxableValue,
                gstAmount,

                cgst: {
                    rate: cgstRate,
                    amount: cgstAmount
                },

                sgst: {
                    rate: sgstRate,
                    amount: sgstAmount
                },

                igst: {
                    rate: igstRate,
                    amount: igstAmount
                },

                totalAmount
            };
        });

        const taxTotals = orderItems.reduce(
            (totals, item) => {
                totals.taxableValue += item.taxableValue;
                totals.cgst += item.cgst.amount;
                totals.sgst += item.sgst.amount;
                totals.igst += item.igst.amount;
                totals.gstTotal += item.gstAmount;

                return totals;
            },
            {
                taxableValue: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                gstTotal: 0
            }
        );

        Object.keys(taxTotals).forEach(key => {
            taxTotals[key] = round2(taxTotals[key]);
        });

        const orderId =
            `ORD-${Date.now()}-${crypto
                .randomBytes(3)
                .toString('hex')
                .toUpperCase()}`;

        let pendingOrder;

        try {
            /*
             * Create the pending local order first.
             * The unique checkoutId protects concurrent requests.
             */
            pendingOrder = await Order.create({
                orderId,
                checkoutId: safeCheckoutId,
                user: userId,
                items: orderItems,
                shippingAddress: address.toObject(),

                paymentMode: 'ONLINE',
                paymentStatus: 'PENDING',
                orderStatus: 'PAYMENT_PENDING',

                subtotal,
                taxableValue: taxTotals.taxableValue,
                discount,
                cgst: taxTotals.cgst,
                sgst: taxTotals.sgst,
                igst: taxTotals.igst,
                gstTotal: taxTotals.gstTotal,
                shippingFee,
                handlingFee,
                finalAmount,

                couponApplied:
                    calculation.couponDetails?.code || null
            });
        } catch (error) {
            /*
             * Two identical requests may pass the first lookup together.
             * The unique database index allows only one insertion.
             */
            if (error.code === 11000) {
                const duplicateOrder = await Order.findOne({
                    user: userId,
                    checkoutId: safeCheckoutId
                });

                if (duplicateOrder) {
                    return returnExistingCheckout(
                        res,
                        duplicateOrder
                    );
                }
            }

            throw error;
        }

        try {
            const razorpayOrder =
                await razorpay.orders.create({
                    // amount: Math.round(finalAmount * 100),
                    amount: Math.round(1 * 100),
                    currency: 'INR',
                    receipt: orderId,
                    notes: {
                        purpose: 'ONLINE_ECOMMERCE',
                        localOrderId:
                            pendingOrder._id.toString()
                    }
                });

            pendingOrder.razorpayOrderId =
                razorpayOrder.id;

            await pendingOrder.save();

            return res.status(201).json({
                success: true,
                message: 'Payment order created',
                data: {
                    localOrderId: pendingOrder._id,
                    orderId: pendingOrder.orderId,
                    razorpayOrderId: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    key: process.env.RAZORPAY_KEY_ID
                }
            });
        } catch (error) {
            await Order.updateOne(
                {
                    _id: pendingOrder._id,
                    paymentStatus: 'PENDING'
                },
                {
                    $set: {
                        paymentStatus: 'FAILED',
                        orderStatus: 'CANCELLED'
                    }
                }
            );

            console.error(
                'Razorpay order creation failed:',
                error
            );

            return res.status(500).json({
                success: false,
                message: 'Unable to initialize payment'
            });
        }
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
                    status: order.orderStatus,
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
            area, city, state, stateCode, pincode,
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
            stateCode,
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

// ==========================================
// ADMIN ORDER CONTROLLERS
// ==========================================

// --- 1. Get All Orders (Admin) ---
exports.getAllOrdersAdmin = async (req, res, next) => {
    try {
        // Fetch all orders, sort by newest, and populate the user details
        const orders = await Order.find()
            .populate('user', 'firstName lastName phone email')
            .sort({ createdAt: -1 });

        // Map through orders to add a fallback for taxAmount so the frontend doesn't break
        const formattedOrders = orders.map(order => {
            const orderObj = order.toObject();
            // If taxAmount isn't in your DB yet, default it to 0
            orderObj.taxAmount = orderObj.taxAmount || 0;
            return orderObj;
        });

        res.status(200).json({
            success: true,
            count: formattedOrders.length,
            data: formattedOrders
        });
    } catch (error) {
        next(error);
    }
};

// --- 2. Update Order Status (Admin) ---
exports.updateOrderStatusAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;

        // Validate the status
        const validStatuses = ['PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { orderStatus: orderStatus },
            { new: true } // Return the updated document
        ).populate('user', 'firstName lastName phone email');

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${orderStatus}`,
            data: updatedOrder
        });
    } catch (error) {
        next(error);
    }
};
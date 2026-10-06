const Razorpay = require('razorpay');
const User = require("../../models/user.model");
const cashbackWalletModel = require("../../models/cashbackWallet.model");
const offlineCartModel = require("../../models/Shop/offlineCart.model");
const orderModel = require("../../models/Shop/order.model");
const { generateInvoicePDF } = require('../../services/pdf.service');
const crypto = require('crypto');

// Initialize Razorpay 
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const round2 = value =>
    Number(Number(value || 0).toFixed(2));

const returnExistingOfflineCheckout = async (
    res,
    orders
) => {
    const allPaid = orders.every(
        order => order.paymentStatus === 'PAID'
    );

    if (allPaid) {
        return res.status(200).json({
            success: true,
            alreadyPaid: true,
            internalOrderIds: orders.map(
                order => order.orderId
            )
        });
    }

    if (
        orders.some(
            order => order.paymentStatus === 'FAILED'
        )
    ) {
        return res.status(409).json({
            success: false,
            message:
                'Previous checkout failed. Start a new checkout.'
        });
    }

    const razorpayOrderId =
        orders.find(order => order.razorpayOrderId)
            ?.razorpayOrderId;

    if (!razorpayOrderId) {
        return res.status(202).json({
            success: false,
            processing: true,
            message:
                'Checkout is being initialized. Please retry.'
        });
    }

    const razorpayOrder =
        await razorpay.orders.fetch(
            razorpayOrderId
        );

    return res.status(200).json({
        success: true,
        reused: true,

        razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        },

        internalOrderIds: orders.map(
            order => order.orderId
        )
    });
};


exports.placeOfflineOrder = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const {
            useCashback = false,
            checkoutId
        } = req.body || {};

        if (!checkoutId?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'checkoutId is required'
            });
        }

        const safeCheckoutId = checkoutId.trim();

        /*
         * Return existing checkout when the frontend
         * retries the same request.
         */
        const existingOrders = await orderModel.find({
            user: userId,
            checkoutId: safeCheckoutId
        });

        if (existingOrders.length > 0) {
            return returnExistingOfflineCheckout(
                res,
                existingOrders
            );
        }

        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.hasActiveCashbackCard) {
            return res.status(403).json({
                success: false,
                error: 'REQUIRE_CASHBACK_CARD',
                message:
                    'You need an active Cashback Card to place local store orders.'
            });
        }

        const cart = await offlineCartModel
            .findOne({ user: userId })
            .populate({
                path: 'items.product',
                populate: {
                    path: 'shop'
                }
            });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Your store cart is empty'
            });
        }

        const groups = new Map();

        /*
         * Validate live product/stock and build
         * separate order calculations for each shop.
         */
        for (const cartItem of cart.items) {
            const product = cartItem.product;
            const quantity = Number(cartItem.quantity);

            if (
                !product ||
                !product.isActive ||
                product.adminDisabled ||
                !product.inStock
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'One or more products are unavailable'
                });
            }

            if (
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Invalid quantity for ${product.name}`
                });
            }

            if (
                !product.shop?._id ||
                !product.shop.isOpen
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Shop is currently unavailable for ${product.name}`
                });
            }

            const selectedSize =
                cartItem.size || null;

            if (product.hasVariants) {
                const variant = product.variants.find(
                    variantItem =>
                        String(variantItem.size) ===
                        String(selectedSize)
                );

                if (!variant) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Selected variant is unavailable for ${product.name}`
                    });
                }

                if (
                    Number(variant.stock || 0) <
                    quantity
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Insufficient stock for ${product.name}`
                    });
                }
            } else if (
                Number(product.totalStock || 0) <
                quantity
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Insufficient stock for ${product.name}`
                });
            }

            const basePrice = Number(
                product.basePrice || 0
            );

            const salePrice = Number(
                product.salePrice
            );

            const hasSalePrice =
                Number.isFinite(salePrice) &&
                salePrice > 0 &&
                salePrice < basePrice;

            const priceBeforeGst = hasSalePrice
                ? salePrice
                : basePrice;

            const gstPercentage = Number(
                product.gstPercentage || 0
            );

            const finalPrice = round2(
                priceBeforeGst *
                (1 + gstPercentage / 100)
            );

            const originalFinalPrice = round2(
                basePrice *
                (1 + gstPercentage / 100)
            );

            const discountPercentage =
                hasSalePrice && basePrice > 0
                    ? Math.round(
                        (
                            (basePrice - salePrice) /
                            basePrice
                        ) * 100
                    )
                    : 0;

            const totalAmount = round2(
                finalPrice * quantity
            );

            const originalLineTotal = round2(
                originalFinalPrice * quantity
            );

            /*
             * Store pickup is treated as supply at
             * the shop, so CGST and SGST are used.
             */
            const taxableValue = round2(
                totalAmount /
                (1 + gstPercentage / 100)
            );

            const gstAmount = round2(
                totalAmount - taxableValue
            );

            const cgstAmount = round2(
                gstAmount / 2
            );

            const sgstAmount = round2(
                gstAmount - cgstAmount
            );

            const shop = product.shop;
            const shopId = shop._id.toString();

            if (!groups.has(shopId)) {
                const gstNumber =
                    shop.taxDetails?.gstNumber || '';

                groups.set(shopId, {
                    shopId,
                    shopSnapshot: {
                        name: shop.name,
                        phone: shop.phone || '',
                        owner: {
                            name:
                                shop.owner?.name || '',
                            mobile:
                                shop.owner?.mobile || '',
                            email:
                                shop.owner?.email || ''
                        },
                        address: {
                            street:
                                shop.address?.street || '',
                            area:
                                shop.address?.area || '',
                            city:
                                shop.address?.city || '',
                            state:
                                shop.address?.state || '',
                            pincode:
                                shop.address?.pincode || ''
                        },
                        taxDetails: {
                            hasGst:
                                Boolean(
                                    shop.taxDetails?.hasGst
                                ),
                            gstNumber,
                            panNumber:
                                shop.taxDetails?.panNumber ||
                                ''
                        },
                        stateCode:
                            gstNumber.length >= 2
                                ? gstNumber.slice(0, 2)
                                : null
                    },

                    items: [],
                    originalSubtotal: 0,
                    subtotal: 0,
                    taxableValue: 0,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    gstTotal: 0
                });
            }

            const group = groups.get(shopId);

            group.items.push({
                product: product._id,
                name: product.name,

                image:
                    product.mainImage?.url ||
                    product.images?.[0]?.url ||
                    '',

                quantity,
                size: selectedSize,

                hsnCode:
                    product.hsnCode || '0000',

                gstPercentage,

                // GST-exclusive unit price
                price: round2(priceBeforeGst),

                // GST-inclusive unit prices
                originalFinalPrice,
                finalPrice,
                discountPercentage,

                // Full line totals
                taxableValue,
                gstAmount,

                cgst: {
                    rate: gstPercentage / 2,
                    amount: cgstAmount
                },

                sgst: {
                    rate: gstPercentage / 2,
                    amount: sgstAmount
                },

                igst: {
                    rate: 0,
                    amount: 0
                },

                totalAmount
            });

            group.originalSubtotal = round2(
                group.originalSubtotal +
                originalLineTotal
            );

            group.subtotal = round2(
                group.subtotal + totalAmount
            );

            group.taxableValue = round2(
                group.taxableValue +
                taxableValue
            );

            group.cgst = round2(
                group.cgst + cgstAmount
            );

            group.sgst = round2(
                group.sgst + sgstAmount
            );

            group.gstTotal = round2(
                group.gstTotal + gstAmount
            );
        }

        const shopGroups = Array.from(
            groups.values()
        );

        const cartTotal = round2(
            shopGroups.reduce(
                (total, group) =>
                    total + group.subtotal,
                0
            )
        );

        /*
         * Keep at least ₹1 payable through Razorpay.
         * The wallet is deducted only after webhook success.
         */
        let totalPointsUsed = 0;

        if (useCashback) {
            const wallet =
                await cashbackWalletModel.findOne({
                    userId
                });

            const walletBalance = Number(
                wallet?.pointsBalance || 0
            );

            totalPointsUsed = round2(
                Math.min(
                    walletBalance,
                    Math.max(0, cartTotal - 1)
                )
            );
        }

        /*
         * Allocate cashback proportionately across
         * each shop order.
         */
        let allocatedPoints = 0;

        shopGroups.forEach((group, index) => {
            const isLast =
                index === shopGroups.length - 1;

            const groupPoints =
                totalPointsUsed > 0
                    ? isLast
                        ? round2(
                            totalPointsUsed -
                            allocatedPoints
                        )
                        : round2(
                            totalPointsUsed *
                            (
                                group.subtotal /
                                cartTotal
                            )
                        )
                    : 0;

            allocatedPoints = round2(
                allocatedPoints + groupPoints
            );

            group.pointsUsed = groupPoints;

            group.payableAmount = round2(
                group.subtotal - groupPoints
            );

            group.productDiscount = round2(
                group.originalSubtotal -
                group.subtotal
            );
        });

        const finalPayable = round2(
            shopGroups.reduce(
                (total, group) =>
                    total + group.payableAmount,
                0
            )
        );

        const customerSnapshot = {
            userId,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            phone: user.phone || '',
            email: user.email || ''
        };

        const pendingOrderDocuments =
            shopGroups.map(group => {
                const orderId =
                    `OFF-${Date.now()}-${crypto
                        .randomBytes(3)
                        .toString('hex')
                        .toUpperCase()}`;

                return {
                    orderId,
                    checkoutId: safeCheckoutId,

                    idempotencyKey:
                        `${userId}:${safeCheckoutId}:${group.shopId}`,

                    user: userId,
                    shop: group.shopId,

                    customerSnapshot,
                    shopSnapshot:
                        group.shopSnapshot,

                    items: group.items,

                    taxType:
                        group.gstTotal > 0
                            ? 'CGST_SGST'
                            : 'NONE',

                    originalSubtotal:
                        group.originalSubtotal,

                    productDiscount:
                        group.productDiscount,

                    subtotal: group.subtotal,

                    taxableValue:
                        group.taxableValue,

                    cgst: group.cgst,
                    sgst: group.sgst,
                    igst: 0,

                    gstTotal: group.gstTotal,

                    pointsUsed:
                        group.pointsUsed,

                    totalAmount:
                        group.subtotal,

                    payableAmount:
                        group.payableAmount,

                    paymentMode: 'ONLINE',
                    paymentStatus: 'PENDING',

                    status: 'Pending',

                    payoutStatus: 'Pending',

                    /*
                     * Cashback is funded by the
                     * platform, so shop value remains
                     * the full order amount.
                     */
                    payoutAmount:
                        group.subtotal
                };
            });

        let pendingOrders;

        try {
            pendingOrders =
                await orderModel.insertMany(
                    pendingOrderDocuments,
                    { ordered: true }
                );
        } catch (error) {
            if (error.code === 11000) {
                const duplicateOrders =
                    await orderModel.find({
                        user: userId,
                        checkoutId: safeCheckoutId
                    });

                if (duplicateOrders.length > 0) {
                    return returnExistingOfflineCheckout(
                        res,
                        duplicateOrders
                    );
                }
            }

            throw error;
        }

        try {
            const oneRupeeTesting =
                process.env
                    .RAZORPAY_ONE_RUPEE_TEST ===
                'true';

            const amountInPaise = oneRupeeTesting
                ? 100
                : 100;//

            const razorpayOrder =
                await razorpay.orders.create({
                    amount: amountInPaise,
                    currency: 'INR',

                    receipt:
                        `OFF-${Date.now()}-${crypto
                            .randomBytes(2)
                            .toString('hex')}`,

                    notes: {
                        purpose:
                            'OFFLINE_ECOMMERCE',

                        checkoutId:
                            safeCheckoutId,

                        userId:
                            String(userId)
                    }
                });

            await orderModel.updateMany(
                {
                    _id: {
                        $in: pendingOrders.map(
                            order => order._id
                        )
                    }
                },
                {
                    $set: {
                        razorpayOrderId:
                            razorpayOrder.id
                    }
                }
            );

            return res.status(201).json({
                success: true,
                message:
                    'Store pickup payment initialized',

                razorpayOrder: {
                    id: razorpayOrder.id,
                    amount:
                        razorpayOrder.amount,

                    currency:
                        razorpayOrder.currency,
                    key:
                        process.env
                            .RAZORPAY_KEY_ID
                },

                checkoutId: safeCheckoutId,

                internalOrderIds:
                    pendingOrders.map(
                        order => order.orderId
                    )
            });
        } catch (error) {
            await orderModel.updateMany(
                {
                    _id: {
                        $in: pendingOrders.map(
                            order => order._id
                        )
                    },
                    paymentStatus: 'PENDING'
                },
                {
                    $set: {
                        paymentStatus: 'FAILED',
                        status: 'Cancelled'
                    }
                }
            );

            throw error;
        }
    } catch (error) {
        console.error(
            'Place Offline Order Error:',
            error
        );

        next(error);
    }
};

// --- GET USER OFFLINE ORDER HISTORY ---
exports.getOfflineOrderHistory = async (req, res, next) => {
    try {
        const userId =
            req.user.id || req.user._id;
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

        const order =
            await orderModel.findByIdAndUpdate(
                orderId,
                {
                    $set: {
                        payoutStatus: 'Settled',
                        payoutSettledAt: new Date()
                    }
                },
                { new: true }
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

exports.downloadOfflineOrderInvoice = async (
    req,
    res,
    next
) => {
    try {
        const { orderId } = req.params;

        const order = await orderModel.findOne({
            orderId,
            paymentStatus: 'PAID'
        }).lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message:
                    'Paid offline order not found'
            });
        }

        if (!order.invoiceNumber) {
            return res.status(409).json({
                success: false,
                message:
                    'Invoice is being generated. Please try again.'
            });
        }

        const shop = order.shopSnapshot || {};
        const shopAddress = shop.address || {};
        const shopTax = shop.taxDetails || {};
        const customer =
            order.customerSnapshot || {};

        const shopStateCode =
            shop.stateCode ||
            String(shopTax.gstNumber || '')
                .slice(0, 2) ||
            'N/A';

        const invoiceItems = order.items.map(
            item => {
                const quantity = Number(
                    item.quantity || 1
                );

                const gstPercentage = Number(
                    item.gstPercentage || 0
                );

                const originalFinalPrice = Number(
                    item.originalFinalPrice ||
                    item.finalPrice ||
                    0
                );

                const finalPrice = Number(
                    item.finalPrice || 0
                );

                const originalRateBeforeGst =
                    gstPercentage > 0
                        ? round2(
                            originalFinalPrice /
                            (
                                1 +
                                gstPercentage / 100
                            )
                        )
                        : round2(originalFinalPrice);

                const discountAmount = Math.max(
                    0,
                    round2(
                        (
                            originalFinalPrice -
                            finalPrice
                        ) * quantity
                    )
                );

                return {
                    description:
                        item.size
                            ? `${item.name} (${item.size})`
                            : item.name,

                    hsn:
                        item.hsnCode || 'N/A',

                    qty: quantity,
                    unit: 'PCS',

                    rate: originalRateBeforeGst,

                    discPercent: Number(
                        item.discountPercentage || 0
                    ),

                    discAmount: discountAmount,

                    taxableValue: Number(
                        item.taxableValue || 0
                    ),

                    cgst: {
                        rate: Number(
                            item.cgst?.rate || 0
                        ),
                        amount: Number(
                            item.cgst?.amount || 0
                        )
                    },

                    sgst: {
                        rate: Number(
                            item.sgst?.rate || 0
                        ),
                        amount: Number(
                            item.sgst?.amount || 0
                        )
                    },

                    igst: {
                        rate: Number(
                            item.igst?.rate || 0
                        ),
                        amount: Number(
                            item.igst?.amount || 0
                        )
                    },

                    totalAmount: Number(
                        item.totalAmount || 0
                    )
                };
            }
        );

        const invoiceData = {
            company: {
                name:
                    'TRUHAAT SALES AND NETWORKING PRIVATE LIMITED',

                address:
                    '29/E/290, GROUND FLOOR, GHARONDA, PRATAP NAGAR, SECTOR-11, SANGANER, JAIPUR RAJASTHAN-302033',

                gstin: '08AAMCT0160D1ZK',

                phone:
                    '01414606217, +91-9314010888',

                email:
                    'INFO.TRUHAAT@GMAIL.COM'
            },

            shop: {
                name: shop.name || 'N/A',

                addressStr: [
                    shopAddress.street,
                    shopAddress.area,
                    shopAddress.city,
                    shopAddress.state,
                    shopAddress.pincode
                ]
                    .filter(Boolean)
                    .join(', '),

                state:
                    shopAddress.state || 'N/A',

                stateCode: shopStateCode,

                gstin:
                    shopTax.gstNumber || 'N/A',

                pan:
                    shopTax.panNumber || 'N/A',

                contactPerson:
                    shop.owner?.name || 'N/A',

                phone:
                    shop.phone ||
                    shop.owner?.mobile ||
                    'N/A',

                email:
                    shop.owner?.email || 'N/A'
            },

            customer: {
                name:
                    [
                        customer.firstName,
                        customer.lastName
                    ]
                        .filter(Boolean)
                        .join(' ') ||
                    'Customer',

                // No shipping address is required
                // because this is store pickup.
                addressStr: 'Store Pickup',

                placeOfSupply:
                    shopAddress.state || 'N/A',

                stateCode: shopStateCode,

                phone:
                    customer.phone || 'N/A',

                email:
                    customer.email || 'N/A'
            },

            invoiceDetails: {
                invoiceNo:
                    order.invoiceNumber,

                orderNo:
                    order.orderId,

                date: new Date(
                    order.paidAt ||
                    order.createdAt
                )
                    .toLocaleDateString('en-GB')
                    .replace(/\//g, '-'),

                paymentTerms: 'ONLINE',

                paymentRef:
                    order.razorpayPaymentId ||
                    'N/A',

                deliveryMethod: 'BY HAND',

                courierName: 'N/A',

                trackingDetails:
                    'Store Pickup'
            },

            taxType:
                order.taxType || 'CGST_SGST',

            items: invoiceItems,

            totals: {
                taxableValue: Number(
                    order.taxableValue || 0
                ),

                cgst: Number(order.cgst || 0),
                sgst: Number(order.sgst || 0),
                igst: Number(order.igst || 0),

                discount: Number(
                    order.productDiscount || 0
                ),

                shippingFee: 0,
                handlingFee: 0,

                // Cashback points are a payment adjustment.
                // The tax invoice remains for full product value.
                grandTotal: Number(
                    order.totalAmount || 0
                )
            }
        };

        return generateInvoicePDF(
            invoiceData,
            res
        );
    } catch (error) {
        console.error(
            'Offline invoice generation error:',
            error
        );

        next(error);
    }
};
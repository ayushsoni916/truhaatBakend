const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
    },

    checkoutId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Snapshot of product details at the time of purchase
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },

        name: String,
        image: String,
        quantity: Number,
        size: String,

        hsnCode: String,
        gstPercentage: Number,

        // GST-exclusive selling price per unit
        price: Number,

        // GST-inclusive selling price per unit
        finalPrice: Number,

        // GST-inclusive base price shown as crossed price
        originalFinalPrice: Number,

        // Product sale discount percentage
        discountPercentage: {
            type: Number,
            default: 0
        },

        // Tax values after coupon allocation
        taxableValue: Number,
        gstAmount: Number,

        cgst: {
            rate: {
                type: Number,
                default: 0
            },
            amount: {
                type: Number,
                default: 0
            }
        },

        sgst: {
            rate: {
                type: Number,
                default: 0
            },
            amount: {
                type: Number,
                default: 0
            }
        },

        igst: {
            rate: {
                type: Number,
                default: 0
            },
            amount: {
                type: Number,
                default: 0
            }
        },

        // Line total after product and coupon discounts
        totalAmount: Number
    }],

    // Snapshot of the address at the time of purchase
    shippingAddress: {
        type: Object,
        required: true
    },

    paymentMode: {
        type: String,
        enum: ['COD', 'ONLINE'],
        required: true
    },

    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED'],
        default: 'PENDING'
    },

    razorpayOrderId: {
        type: String,
        unique: true,
        sparse: true
    },

    razorpayPaymentId: {
        type: String,
        unique: true,
        sparse: true
    },

    paidAt: Date,

    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },

    orderStatus: {
        type: String,
        enum: [
            'PAYMENT_PENDING',
            'PLACED',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED'
        ],
        default: 'PAYMENT_PENDING'
    },

    // GST-inclusive item subtotal before coupon
    subtotal: {
        type: Number,
        required: true
    },

    // Total taxable amount after coupon allocation
    taxableValue: {
        type: Number,
        default: 0
    },

    // Coupon discount
    discount: {
        type: Number,
        default: 0
    },

    cgst: {
        type: Number,
        default: 0
    },

    sgst: {
        type: Number,
        default: 0
    },

    igst: {
        type: Number,
        default: 0
    },

    gstTotal: {
        type: Number,
        default: 0
    },

    shippingFee: {
        type: Number,
        default: 0
    },

    handlingFee: {
        type: Number,
        default: 0
    },

    finalAmount: {
        type: Number,
        required: true
    },

    couponApplied: {
        type: String,
        default: null
    }

}, {
    timestamps: true,
    versionKey: false
});

const Order = mongoose.model(
    'Order',
    orderSchema
);

module.exports = Order;
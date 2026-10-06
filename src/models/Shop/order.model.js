const mongoose = require('mongoose');

const offlineOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    checkoutId: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    idempotencyKey: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true,
        index: true
    },

    // Frozen information for future invoice generation
    customerSnapshot: {
        type: Object,
        default: {}
    },

    shopSnapshot: {
        type: Object,
        required: true
    },


    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShopProduct',
            required: true
        },

        name: {
            type: String,
            required: true
        },

        image: {
            type: String,
            default: ''
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        size: {
            type: String,
            default: null
        },

        hsnCode: {
            type: String,
            required: true
        },

        gstPercentage: {
            type: Number,
            required: true,
            default: 0
        },

        // Selling price before GST, per unit
        price: {
            type: Number,
            required: true
        },

        // GST-inclusive base price, per unit
        originalFinalPrice: {
            type: Number,
            required: true
        },

        // GST-inclusive selling price, per unit
        finalPrice: {
            type: Number,
            required: true
        },

        discountPercentage: {
            type: Number,
            default: 0
        },

        // Totals for the complete line quantity
        taxableValue: {
            type: Number,
            required: true
        },

        gstAmount: {
            type: Number,
            required: true,
            default: 0
        },

        cgst: {
            rate: { type: Number, default: 0 },
            amount: { type: Number, default: 0 }
        },

        sgst: {
            rate: { type: Number, default: 0 },
            amount: { type: Number, default: 0 }
        },

        igst: {
            rate: { type: Number, default: 0 },
            amount: { type: Number, default: 0 }
        },

        // GST-inclusive line total
        totalAmount: {
            type: Number,
            required: true
        }
    }],

    taxType: {
        type: String,
        enum: ['CGST_SGST', 'IGST', 'NONE'],
        required: true
    },

    // Sum of GST-inclusive original prices
    originalSubtotal: {
        type: Number,
        required: true,
        default: 0
    },
    // Product discount before cashback
    productDiscount: {
        type: Number,
        required: true,
        default: 0
    },

    // GST-inclusive selling total before cashback
    subtotal: {
        type: Number,
        required: true
    },

    taxableValue: {
        type: Number,
        required: true,
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

    pointsUsed: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: { type: Number, required: true },
    // Actual amount included in Razorpay payment
    payableAmount: {
        type: Number,
        required: true,
        min: 0
    },

    paymentMode: {
        type: String,
        enum: ['ONLINE'],
        default: 'ONLINE'
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true
    },

    /*
    * These must not be unique because one Razorpay payment
    * can contain multiple shop orders.
    */
    razorpayOrderId: {
        type: String,
        default: null,
        index: true
    },

    razorpayPaymentId: {
        type: String,
        default: null,
        index: true
    },

    paidAt: {
        type: Date,
        default: null
    },

    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },

    invoiceGeneratedAt: {
        type: Date,
        default: null
    },

    status: {
        type: String,
        enum: [
            'Pending',
            'Accepted',
            'Ready',
            'Completed',
            'Cancelled'
        ],
        default: 'Pending',
        index: true
    },

    payoutStatus: {
        type: String,
        enum: ['Pending', 'Settled'],
        default: 'Pending'
    },

    payoutAmount: {
        type: Number,
        default: 0
    },

    payoutSettledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model(
    'OfflineOrder',
    offlineOrderSchema
);
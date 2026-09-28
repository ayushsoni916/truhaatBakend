const mongoose = require('mongoose')

const planPurchaseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    razorpayOrderId: {
        type: String,
        sparse: true, // Allows null/empty values for manual or non-gateway entries if needed
        index: true
    },
    razorpayPaymentId: {
        type: String
    },
    paidAt: {
        type: Date,
        default: Date.now
    },
    // ==========================================
    // NEW: PHYSICAL DISPATCH & INVOICING FIELDS
    // ==========================================
    invoiceNumber: {
        type: String,
        sparse: true, // CRITICAL: Allows old purchases to exist without crashing the DB
        unique: true
    },
    shippingAddress: {
        type: Object // Snapshot of the user's address exactly as it was when they bought it
    },
    deliveryMethod: {
        type: String,
        enum: ['BY_HAND', 'COURIER'],
        default: 'COURIER'
    },
    deliveryStatus: {
        type: String,
        enum: [
            'PENDING',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED'
        ],
        default: 'PENDING'
    },
    trackingDetails: {
        courierPartner: { type: String, default: '' },
        trackingId: { type: String, default: '' }
    },
    bundleSnapshot: {
        type: Object // Snapshot of plan.bundleInfo (items, HSN, banner) at the time of purchase
    }
}, {
    timestamps: true,
    versionKey: false
})

const PlanPurchase = mongoose.model('PlanPurchase', planPurchaseSchema)

module.exports = PlanPurchase
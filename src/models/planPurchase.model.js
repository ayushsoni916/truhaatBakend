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
    }
}, {
    timestamps: true,
    versionKey: false
})

const PlanPurchase = mongoose.model('PlanPurchase', planPurchaseSchema)

module.exports = PlanPurchase
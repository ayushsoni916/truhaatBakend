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
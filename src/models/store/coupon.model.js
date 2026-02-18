const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: { type: String, required: true }, // e.g., "Get 50% off up to ₹100"
    discountType: {
        type: String,
        enum: ['PERCENTAGE', 'FLAT'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    maxDiscountAmount: {
        type: Number, // Useful for percentage coupons (e.g. 50% off upto 200)
        default: null
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Coupon', couponSchema);
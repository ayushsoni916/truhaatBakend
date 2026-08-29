const mongoose = require('mongoose');

const offlineOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopProduct' },
        name: String,
        price: Number,
        quantity: Number,
        size: { type: String, default: null }, // NEW: Variant support
        image: String
    }],
    totalAmount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['Pending', 'Accepted', 'Ready', 'Completed', 'Cancelled'], 
        default: 'Pending' 
    },
    
    // === NEW ADMIN LEDGER & PAYMENT FIELDS ===
    razorpayOrderId: { type: String, default: null, index: true },
    pointsUsed: { type: Number, default: 0 },
    payoutStatus: { 
        type: String, 
        enum: ['Pending', 'Settled'], 
        default: 'Pending' 
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('OfflineOrder', offlineOrderSchema);
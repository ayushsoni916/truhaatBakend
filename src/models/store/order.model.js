const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // SNAPSHOT: Store the details as they were AT THE TIME of purchase
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        image: String,
        quantity: Number,
        size: String,
        price: Number // The price the user actually paid
    }],
    
    shippingAddress: { type: Object, required: true }, // Snapshot of address

    paymentMode: { type: String, enum: ['COD', 'ONLINE'], required: true },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
    orderStatus: { type: String, enum: ['PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], default: 'PLACED' },

    // Financials
    subtotal: Number,
    discount: Number,
    shippingFee: { type: Number, default: 0 },
    finalAmount: Number,

    couponApplied: { type: String, default: null }

}, {
    timestamps: true,
    versionKey: false
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
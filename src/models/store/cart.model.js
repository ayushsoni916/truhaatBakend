const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product', // Ensure this matches your Product model name
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        size: {
            type: String,
            default: null // Optional: e.g. "M", "L", "UK-9"
        }
    }],
    couponCode: {
        type: String, // Just store the code string. We validate it on every GET request.
        default: null
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Cart', cartSchema);
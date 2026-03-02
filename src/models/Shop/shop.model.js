const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    // Changed: Store Owner Details directly instead of User ID
    owner: {
        name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true },
        email: { type: String, trim: true }
    },

    name: {
        type: String,
        required: true,
        trim: true
    },
    // This is the public shop phone number (might be different from owner's mobile)
    phone: {
        type: String,
        required: true
    },

    // Categorization
    mainCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MainShopCategory',
        required: true
    },
    // Location & Address
    address: {
        street: String,
        area: String,
        city: String,
        state: String,
        pincode: String
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true // [longitude, latitude]
        }
    },

    // Visuals
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],

    description: { type: String },
    rating: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: true }

}, { timestamps: true });

shopSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Shop', shopSchema);
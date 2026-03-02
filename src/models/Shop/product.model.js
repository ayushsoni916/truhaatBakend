const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String },

    // Pricing
    price: { type: Number, required: true },
    salePrice: { type: Number }, // Discounted price
    stock: { type: Number, default: 0 },

    // Updated Image Logic
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],

    // Organization (Admin IDs)
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopCategory', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopSubCategory', required: true },
    tag: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopTag', required: true },

    // Search Keywords (Shop Defined)
    subtags: [{ type: String, trim: true }],

    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Create a text index for high-performance search
productSchema.index({ name: 'text', subtags: 'text' });

module.exports = mongoose.model('ShopProduct', productSchema);
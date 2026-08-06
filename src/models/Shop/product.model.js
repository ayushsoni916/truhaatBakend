const mongoose = require('mongoose');

// Helper function to limit search keywords to max 5
function keywordLimit(val) {
    return val.length <= 5;
}

const shopProductSchema = new mongoose.Schema({
    // --- 1. Core Associations ---
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true,
        index: true
    },

    // --- 2. Basic Info ---
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },

    // --- 3. Taxonomy & Search ---
    // Inherited automatically from the Shop's firmCategory via backend API
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopCategory',
        required: true
    },

    // Chosen by the shop owner when uploading the product
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopSubCategory',
        required: true
    },

    // Serves as the Gender / Target Audience (References ShopTag: Men, Women, Kids, etc.)
    tag: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopTag',
        required: true
    },

    // Custom keywords entered by the shopkeeper (Max 5)
    searchKeywords: {
        type: [{ type: String, trim: true }],
        validate: [keywordLimit, 'You can only add up to 5 search keywords']
    },

    // --- 4. Pricing & Tax ---
    basePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0 },
    gstPercentage: { type: Number, enum: [0, 5, 12, 18, 28], required: true },
    hsnCode: { type: String, required: true, trim: true },

    // --- 5. Media ---
    mainImage: {
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    },
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],

    // --- 6. Dynamic Data (e.g., Material: Cotton, Fit: Slim) ---
    specifications: [{
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true }
    }],

    // --- 7. Inventory & Variants ---
    hasVariants: { type: Boolean, default: false },
    totalStock: { type: Number, default: 0 },
    variants: [{
        size: { type: String, required: true, trim: true }, // e.g., "XL", "10", "1kg"
        color: { type: String, trim: true }, // e.g., "Red", "Blue"
        stock: { type: Number, required: true, min: 0 },
        sku: { type: String, trim: true } // Shopkeeper's internal barcode/ID
    }],

    // --- 8. Status ---
    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

// Create a powerful text index for the search bar
shopProductSchema.index({ name: 'text', searchKeywords: 'text' });

module.exports = mongoose.model('ShopProduct', shopProductSchema);
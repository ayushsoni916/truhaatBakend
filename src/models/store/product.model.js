const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    // Basic Info
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    gender: { type: String, enum: ['Men', 'Women', 'Kids', 'Unisex'], required: false },

    // Taxonomy
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    searchKeywords: [{ type: String, trim: true }],

    // Pricing & Tax
    basePrice: { type: Number, required: true },
    salePrice: { type: Number },
    gstPercentage: { type: Number, enum: [0, 5, 12, 18, 28], required: true },
    hsnCode: { type: String, required: true, trim: true },

    // Media
    mainImage: {
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    },
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],

    // Global Specifications (If no variants, or specs shared by all variants)
    specifications: [{
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true }
    }],

    // Inventory & Variants
    hasVariants: { type: Boolean, default: false },
    totalStock: { type: Number, default: 0 },
    variants: [{
        size: { type: String, required: true, trim: true },
        color: { type: String, trim: true },
        stock: { type: Number, required: true, min: 0 },
        sku: { type: String, trim: true },
        
        // NEW: Variant-Specific Specifications (e.g., Weight changes based on size)
        specifications: [{
            key: { type: String, required: true, trim: true },
            value: { type: String, required: true, trim: true }
        }]
    }],

    // Status
    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

productSchema.index({ name: 'text', searchKeywords: 'text' });
module.exports = mongoose.model('Product', productSchema);
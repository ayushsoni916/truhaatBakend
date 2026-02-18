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
    
    // Visuals
    image: { type: String, required: true }, // Main image
    gallery: [{ type: String }], // Additional images
    
    // Organization
    category: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ShopCategory' 
    },
    subCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ShopSubCategory' 
    },
    
    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('ShopProduct', productSchema);
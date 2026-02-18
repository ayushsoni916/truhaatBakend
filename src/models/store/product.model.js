const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    // Reference to the Category model we just created
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    price: { 
        type: Number, 
        required: true 
    },
    discountPercentage: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        required: true
    },
    mainImage: {
        type: String,
        required: true
    },
    images: [String], // Array of additional images
    stock: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Product', productSchema);
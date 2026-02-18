const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    parentCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'ShopCategory', 
        required: true 
    },
    image: { 
        type: String, 
        required: true 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('ShopSubCategory', subCategorySchema);
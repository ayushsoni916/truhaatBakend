const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    parentCategory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: true 
    },
    image: { 
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('SubCategory', subCategorySchema);
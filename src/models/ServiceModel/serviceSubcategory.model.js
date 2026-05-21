const mongoose = require('mongoose');

const serviceSubcategorySchema = new mongoose.Schema({
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true // Subcategory wireframe shows distinct visual cards
    },
    imagePublicId: {
        type: String,
        required: true // Saved for clean cloud storage deletion or overwrites
    },
    basePrice: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true,
    versionKey: false
});

serviceSubcategorySchema.index({ parentCategory: 1, name: 1 }, { unique: true });

const ServiceSubcategory = mongoose.model('ServiceSubcategory', serviceSubcategorySchema);
module.exports = ServiceSubcategory;
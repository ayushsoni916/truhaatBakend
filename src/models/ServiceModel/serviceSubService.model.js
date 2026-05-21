const mongoose = require('mongoose');

const serviceSubServiceSchema = new mongoose.Schema({
    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceSubcategory',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: '' // e.g., "Includes 100% safe refrigerant top-up"
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

// Enforce a rule that sub-service names must be unique within their parental subcategory scope
serviceSubServiceSchema.index({ subcategory: 1, name: 1 }, { unique: true });

const ServiceSubService = mongoose.model('ServiceSubService', serviceSubServiceSchema);
module.exports = ServiceSubService;
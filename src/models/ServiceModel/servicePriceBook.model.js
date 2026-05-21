const mongoose = require('mongoose');

const servicePriceBookSchema = new mongoose.Schema({
    subService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceSubService',
        required: true,
        index: true
    },
    country: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        default: 'india'
    },
    state: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    city: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    locality: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
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

// Compound unique constraint to guarantee no duplicate prices can be assigned to the exact same location block
servicePriceBookSchema.index(
    { subService: 1, country: 1, state: 1, city: 1, locality: 1 }, 
    { unique: true }
);

const ServicePriceBook = mongoose.model('ServicePriceBook', servicePriceBookSchema);
module.exports = ServicePriceBook;
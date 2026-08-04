const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    // --- 1. Firm / Company Details ---
    name: {
        type: String,
        required: true,
        trim: true
    },
    // CHANGED: Now references your ShopCategory model dynamically
    firmCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShopCategory',
        required: true
    },
    phone: {
        type: String
    },

    // --- 2. Authorized Person Details ---
    owner: {
        name: { type: String, required: true, trim: true },
        designation: { type: String, required: true, trim: true },
        mobile: { type: String, required: true },
        email: { type: String, required: true, trim: true }
    },

    // --- 3. Address & Location ---
    address: {
        street: { type: String, required: true },
        area: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true // [longitude, latitude]
        }
    },

    // --- 4. Bank Details ---
    bankDetails: {
        beneficiaryName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true },
        bankName: { type: String, required: true },
        bankAddress: { type: String }
    },

    // --- 5. Tax & Compliance ---
    taxDetails: {
        panNumber: { type: String, required: true, uppercase: true, trim: true },
        hasGst: { type: Boolean, required: true, default: false },
        gstNumber: { type: String, uppercase: true, trim: true },
        altDocType: { type: String },
        altDocNumber: { type: String, trim: true }
    },

    // --- 6. Document Uploads (Images/PDFs) ---
    documents: {
        panCard: { url: { type: String, required: true }, publicId: { type: String, required: true } },
        cancelledCheque: { url: { type: String, required: true }, publicId: { type: String, required: true } },
        complianceCertificate: { url: { type: String, required: true }, publicId: { type: String, required: true } }
    },

    // --- 7. Visuals ---
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],

    // --- 8. Marketplace Data ---
    description: { type: String },
    rating: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: true }

}, { timestamps: true });

// Index for Geospatial queries
shopSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Shop', shopSchema);
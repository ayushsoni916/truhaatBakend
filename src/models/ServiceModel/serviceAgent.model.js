const mongoose = require('mongoose');

const serviceAgentSchema = new mongoose.Schema({
    // --- 1. Basic Details ---
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true, sparse: true },

    // RESTORED TO ROOT LEVEL
    profilePic: { type: String, default: '' },

    allowedCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: true,
        index: true
    },
    description: { type: String },

    // --- 2. Address Details ---
    address: {
        street: { type: String, required: true },
        area: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },

    // --- 3. Bank Details ---
    bankDetails: {
        beneficiaryName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true },
        bankName: { type: String, required: true },
        bankAddress: { type: String }
    },

    // --- 4. Identity & Compliance ---
    taxDetails: {
        panNumber: { type: String, required: true, uppercase: true, trim: true },
        hasGst: { type: Boolean, required: true, default: false },
        gstNumber: { type: String, uppercase: true, trim: true },
        altDocType: { type: String },
        altDocNumber: { type: String, trim: true }
    },

    // --- 5. Document Uploads (Only physical docs here now) ---
    documents: {
        panCard: { url: { type: String, required: true }, publicId: { type: String, required: true } },
        cancelledCheque: { url: { type: String, required: true }, publicId: { type: String, required: true } },
        identityDocument: { url: { type: String, required: true }, publicId: { type: String, required: true } }
    },

    // --- 6. States & Metrics ---
    isActive: { type: Boolean, default: true, index: true },
    isOnline: { type: Boolean, default: false, index: true },
    totalEnquiriesActive: { type: Number, default: 0 },
    totalEnquiriesClosed: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }

}, {
    timestamps: true,
    versionKey: false
});

serviceAgentSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('ServiceAgent', serviceAgentSchema);
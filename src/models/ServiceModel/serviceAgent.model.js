const mongoose = require('mongoose');

const serviceAgentSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true
    },
    profilePic: {
        type: String,
        default: ''
    },
    // The core domain assigned by Admin (e.g., Electrician, Plumber)
    allowedCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: true,
        index: true
    },
    // For tracking operational states (e.g., suspended or active)
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // Metrics tracked automatically as they process transactions
    totalEnquiriesActive: {
        type: Number,
        default: 0
    },
    totalEnquiriesClosed: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,   // Automatically creates createdAt and updatedAt fields
    versionKey: false
});


const ServiceAgent = mongoose.model('ServiceAgent', serviceAgentSchema);
module.exports = ServiceAgent;
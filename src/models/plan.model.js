const mongoose = require('mongoose')

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    benefits: {
        type: [String],   // array of strings
        default: []
    },
    planType: {
        type: String,
        enum: ['USER', 'SUBADMIN'],
        required: true
    },
    referralPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    // Add this to your existing planSchema
    bundleInfo: {
        comboName: { type: String, default: 'Life Upgrade Combo' },
        bannerImage: { type: String, default: '' },
        // We store the exact invoice lines here so the bill generates perfectly
        invoiceItems: [{
            itemName: String,
            hsnCode: String,
            qty: { type: Number, default: 1 },
            rate: Number,
            taxPercent: Number // e.g., 5 for 5%, 3 for 3%, 18 for 18%
        }]
    }
}, {
    timestamps: true,
    versionKey: false
})

const Plan = mongoose.model('Plan', planSchema)

module.exports = Plan
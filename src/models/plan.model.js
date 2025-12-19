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
    }
}, {
    timestamps: true,
    versionKey: false
})

const Plan = mongoose.model('Plan', planSchema)

module.exports = Plan
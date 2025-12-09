const mongoose = require('mongoose')

const adminStatsSchema = new mongoose.Schema({
    // --- Plan revenue side ---
    totalMlmUsers: {
        type: Number,
        default: 0
    },

    totalPlansSold: {
        type: Number,
        default: 0
    },

    // total MLM money admin received
    adminMlmIncome: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true,
    versionKey: false
})
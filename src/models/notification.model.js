const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    }
}, { 
    timestamps: true, // Used to get the "latest 10"
    versionKey: false 
});

module.exports = mongoose.model("Notification", notificationSchema);
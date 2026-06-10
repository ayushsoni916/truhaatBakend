const mongoose = require('mongoose');

const serviceBookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceAgent',
        required: true,
        index: true
    },
    subService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceSubService',
        required: true
    },
    pincode: {
        type: String,
        required: true,
        index: true
    },
    bookingLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    finalPrice: {
        type: Number,
        required: true
    },
    completionOtp: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    }
}, {
    timestamps: true,
    versionKey: false
});

serviceBookingSchema.index({ bookingLocation: '2dsphere' });

const ServiceBooking = mongoose.model('ServiceBooking', serviceBookingSchema);
module.exports = ServiceBooking;
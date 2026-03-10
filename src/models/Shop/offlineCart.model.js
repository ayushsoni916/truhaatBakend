const mongoose = require('mongoose');

const offlineCartSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        unique: true 
    },
    items: [{
        product: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'ShopProduct', 
            required: true 
        },
        quantity: { 
            type: Number, 
            required: true, 
            min: 1, 
            default: 1 
        }
    }]
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('OfflineCart', offlineCartSchema);
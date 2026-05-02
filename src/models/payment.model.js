const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true }, // Store in Rupees or Paise (be consistent)
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
  paymentType: { type: String, enum: ['StoreOrder', 'Membership'], required: true },
  metadata: { 
    productId: { type: mongoose.Schema.Types.ObjectId }, // If StoreOrder
    planId: { type: mongoose.Schema.Types.ObjectId },    // If Membership
    addressId: String 
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
const mongoose = require('mongoose');

const cashbackTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true // e.g., +10 (Points Credited), -50 (Points Redeemed)
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  description: {
    type: String,
    required: true,
    default: 'Product Purchase Cashback' // e.g., "Silver Product Purchase Bonus"
  },
  razorpayOrderId: {
    type: String, // Tracks if points were acquired from processing order purchases
    default: null
  }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('CashbackTransaction', cashbackTransactionSchema);
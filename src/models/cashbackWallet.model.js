const mongoose = require('mongoose');

const cashbackWalletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Saved points balance values accumulator
  pointsBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  lifetimePointsEarned: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('CashbackWallet', cashbackWalletSchema);
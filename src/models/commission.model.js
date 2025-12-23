const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  // Who earned this commission (null = admin)
  earner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // USER = normal user/subadmin, ADMIN = platform
  earnerType: {
    type: String,
    enum: ['USER', 'ADMIN'],
    required: true
  },

  // Who's purchase generated this
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },

  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlanPurchase',
    required: true,
    index: true
  },

  // Level in MLM tree (1–9) or null for root 1%
  level: {
    type: Number,
    default: null
  },

  // MLM_LEVEL = 10% tree, ROOT_1P = 1% root subadmin/admin
  kind: {
    type: String,
    enum: ['MLM_LEVEL', 'ROOT_1P', 'SUBADMIN_REFERRAL'],
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  // FROZEN until user completes pair, then RELEASED
  status: {
    type: String,
    enum: ['FROZEN', 'RELEASED'],
    required: true,
    default: 'FROZEN'
  }

}, {
  timestamps: true,
  versionKey: false
});

const Commission = mongoose.model('Commission', commissionSchema);

module.exports = Commission;

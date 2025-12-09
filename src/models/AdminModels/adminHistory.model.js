const mongoose = require("mongoose");

const adminHistorySchema = new mongoose.Schema({

  type: {
    type: String,
    enum: ["PLAN_PURCHASE", "ADMIN_INCOME"],
    required: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },

  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    required: false
  },

  amount: {
    type: Number,
    default: 0
  },

  description: {
    type: String,
    default: ""
  }

}, {
  timestamps: true,
  versionKey: false
});

const AdminHistory = mongoose.model("AdminHistory", adminHistorySchema);
module.exports = AdminHistory;

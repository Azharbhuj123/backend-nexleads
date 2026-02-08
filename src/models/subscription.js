const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'platinum'],
    required: true,
  },
  billingCycle: {
    type: String
  },
  price: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired'],
    default: 'active',
  },
  paymentMethod: {
    type: String,
  },
  transactionId: {
    type: String,
  },
});

module.exports = mongoose.model('Subscription', subscriptionSchema);

const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobField: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    required: true,
  },
  totalLeadsSent: {
    type: Number,
    default: 0,
  },
  followUpsSent: {
    type: Number,
    default: 0,
  },
  emailsOpened: {
    type: Number,
    default: 0,
  },
  repliesReceived: {
    type: Number,
    default: 0,
  },
  emailsBounced: {
    type: Number,
    default: 0,
  },
  lastFollowUpDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('FollowUp', followUpSchema);

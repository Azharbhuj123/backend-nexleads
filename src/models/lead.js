const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['LinkedIn', 'Upwork', 'Twitter', 'Other'],
    required: true,
  },
  jobField: {
    type: String,
    required: true,
  },
  jobTitle: {
    type: String,
  },
  company: {
    type: String,
  },
  location: {
    type: String,
  },
  profileUrl: {
    type: String,
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'responded', 'in_discussion', 'ongoing', 'completed', 'rejected'],
    default: 'new',
  },
  interest: {
    type: String,
    enum: ['interested', 'not_interested'],
    default: 'interested',
  },
  emailsSent: {
    type: Number,
    default: 0,
  },
  emailsOpened: {
    type: Number,
    default: 0,
  },
  responses: {
    type: Number,
    default: 0,
  },
  lastContactedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Lead', leadSchema)
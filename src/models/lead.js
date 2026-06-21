const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    // Scraped pages often expose an email but no parseable name, so this can't
    // be strictly required or those valid leads silently fail to insert.
    type: String,
    default: 'Unknown',
  },
  email: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    // Must cover every platform detectPlatform() in leadfetcher.js can emit,
    // otherwise enum validation drops Google/Facebook/Reddit/Indeed leads.
    enum: ['Google', 'LinkedIn', 'Upwork', 'Twitter', 'Facebook', 'Reddit', 'Indeed', 'Other'],
    default: 'Other',
  },
  jobField: {
    type: String,
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
const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
  },
  followUpId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FollowUp',
    index: true,
  },
  originalEmailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    index: true,
  },
  from: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    default: '',
  },
  attachments: [{
    filename: String,
    url: String,
  }],
  type: {
    type: String,
    enum: ['sent', 'received', 'draft'],
    default: 'sent',
  },
  folder: {
    type: String,
    enum: ['inbox', 'sent', 'drafts', 'spam', 'trash'],
    default: 'sent',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isOpened: {
    type: Boolean,
    default: false,
  },
  isBounced: {
    type: Boolean,
    default: false,
  },
  messageId: {
    type: String,
    index: true,
  },
  providerMessageId: {
    type: String,
    index: true,
  },
  replyAlias: {
    type: String,
    index: true,
  },
  inReplyTo: {
    type: String,
    index: true,
  },
  threadId: {
    type: String,
    index: true,
  },
  references: [String],
  matchStatus: {
    type: String,
    enum: ['matched', 'unmatched'],
  },
  headers: {
    type: mongoose.Schema.Types.Mixed,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  receivedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('Email', emailSchema);

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  company: {
    type: String,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ['in_discussion', 'ongoing', 'completed'],
    default: 'in_discussion',
  },
  budget: {
    type: Number,
  },
  deadline: {
    type: Date,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Project', projectSchema);
const FollowUp = require('../models/followup');
const Email = require('../models/email');
const User = require('../models/user');
const Lead = require('../models/lead');
const { sendEmail, formatEmailHtml } = require('../utils/helper');

const getReplyAlias = (emailId) => `reply+${emailId}@${process.env.REPLY_DOMAIN || 'nexleads.online'}`;

const applySentMetadata = async (email, result, replyAlias) => {
  email.replyAlias = replyAlias;

  if (result.success) {
    email.providerMessageId = result.messageId;
    email.messageId = result.messageId;
    email.threadId = email.threadId || result.messageId;
    email.sentAt = new Date();
  }

  await email.save();
};


exports.getFollowUpStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform, dateFrom, dateTo } = req.query;

    const filter = { userId };
    if (platform) filter.platform = platform;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const followUps = await FollowUp.find(filter).sort({ createdAt: -1 });
    console.log('Fetched follow-up stats', { followUps, count: followUps.length, userId: userId.toString() });

    res.json({
      count: followUps.length,
      followUps,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching follow-ups', error: error.message });
  }
};

exports.sendFollowUp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { followUpId } = req.params;
    const { subject, body, recipients } = req.body;

    const followUp = await FollowUp.findOne({ _id: followUpId, userId });
    if (!followUp) {
      return res.status(404).json({ message: 'Follow-up record not found' });
    }

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    const formattedBody = formatEmailHtml(body);

    for (const recipient of recipients) {
      const email = await Email.create({
        userId,
        leadId: recipient.leadId,
        followUpId,
        from: userData.nexleadsEmail,
        to: recipient.email,
        subject,
        body,
        type: 'sent',
        folder: 'sent',
      });

      const replyAlias = getReplyAlias(email._id);
      const result = await sendEmail({
        from: `NexLeads <${process.env.SMTP_EMAIL}>`,
        replyTo: replyAlias,
        to: recipient.email,
        subject,
        html: formattedBody,
        headers: {
          'X-Entity-Ref-ID': email._id.toString(),
        },
      });

      await applySentMetadata(email, result, replyAlias);

      if (recipient.leadId) {
        await Lead.findByIdAndUpdate(recipient.leadId, {
          $inc: { emailsSent: 1 },
          lastContactedAt: new Date(),
          status: 'contacted',
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update follow-up stats
    followUp.followUpsSent += recipients.length;
    followUp.lastFollowUpDate = new Date();
    await followUp.save();

    res.json({
      message: 'Follow-up emails sent successfully',
      followUp,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending follow-up', error: error.message });
  }
};

exports.createFollowUpRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobField, platform, totalLeadsSent } = req.body;

    const followUp = await FollowUp.create({
      userId,
      jobField,
      platform,
      totalLeadsSent,
    });

    res.status(201).json({
      message: 'Follow-up record created',
      followUp,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating follow-up record', error: error.message });
  }
};

exports.updateFollowUpStats = async (req, res) => {
  try {
    const { followUpId } = req.params;
    const updates = req.body;

    const followUp = await FollowUp.findOneAndUpdate(
      { _id: followUpId, userId: req.user.id },
      updates,
      { new: true }
    );

    if (!followUp) {
      return res.status(404).json({ message: 'Follow-up record not found' });
    }

    res.json({
      message: 'Follow-up stats updated',
      followUp,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating follow-up stats', error: error.message });
  }
};

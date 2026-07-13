
const Email = require('../models/email');
const Lead = require('../models/lead');
const User = require('../models/user');

const { sendEmail, formatEmailHtml } = require('../utils/helper');
const { uploadToS3 } = require('../utils/s3Uploader');
const { simpleParser } = require('mailparser');
const Imap = require('imap');
const { fetchNewReplies } = require('../utils/emailSyncService');

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

exports.composeEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, body, leadIds, to } = req.body;

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    let leadsArray = [];
    if (leadIds) {
      leadsArray = typeof leadIds === "string" ? JSON.parse(leadIds) : leadIds;
    }

    const leads = Array.isArray(leadsArray) && leadsArray.length
      ? await Lead.find({ _id: { $in: leadsArray } })
      : [];

    const recipients = leads.map((lead) => ({
      email: lead.email,
      lead,
    }));

    if (!recipients.length && to) {
      String(to)
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
        .forEach((email) => recipients.push({ email, lead: null }));
    }

    if (!recipients.length) {
      return res.status(404).json({ message: "No recipients found" });
    }

    // Upload attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await uploadToS3(file.buffer, file.originalname);
        attachments.push({ filename: file.originalname, url: fileUrl });
      }
    }
    const emailsSent = [];
    const formattedBody = formatEmailHtml(body);

    for (const recipient of recipients) {
      const lead = recipient.lead;
      const emailData = {
        userId,
        leadId: lead?._id,
        from: userData.nexleadsEmail,
        to: recipient.email,
        subject,
        body,
        attachments,
        type: "sent",
        folder: "sent",
      };

      const email = await Email.create(emailData);
      const replyAlias = getReplyAlias(email._id);

      const trackingPixel = `
        <img src="${process.env.API_BASE_URL}/user/open/${email._id}.png" style="display:none" />
      `;

      const emailOptions = {
        from: `NexLeads <${process.env.SMTP_EMAIL}>`,
        replyTo: replyAlias,
        to: recipient.email,
        subject,
        html: formattedBody + trackingPixel,
        attachments: attachments.map(att => ({ filename: att.filename, path: att.url })),
        headers: {
          "X-Entity-Ref-ID": email._id.toString()
        }
      };

      const result = await sendEmail(emailOptions);
      await applySentMetadata(email, result, replyAlias);

      // Update lead stats
      if (lead?._id) {
        await Lead.findByIdAndUpdate(lead._id, {
          $inc: { emailsSent: 1 },
          lastContactedAt: new Date(),
          status: "contacted",
        });
      }

      emailsSent.push(email);
    }

    res.status(201).json({
      message: "Emails sent successfully",
      emailsSent,
      count: emailsSent.length,
    });
  } catch (error) {
    console.error("Compose email error:", error);
    res.status(500).json({
      message: "Error sending emails",
      error: error.message,
    });
  }
};
exports.trackingEmail = async (req, res) => {
  try {
    const { emailId } = req.params;
    console.log('on tracking email', emailId);

    const email = await Email.findById(emailId);
    if (!email) return res.sendStatus(404);

    email.isOpened = true;
    email.isRead = true;
    email.folder = 'inbox';

    await email.save();

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
      'base64'
    );

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(pixel);

  } catch (err) {
    res.sendStatus(500);
  }
};


exports.sendBulkEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipients, subject, body } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients array is required' });
    }

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const formattedBody = formatEmailHtml(body);
    const results = [];

    for (const recipient of recipients) {
      const email = await Email.create({
        userId,
        leadId: recipient.leadId,
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
      results.push(result);

      if (recipient.leadId) {
        await Lead.findByIdAndUpdate(recipient.leadId, {
          $inc: { emailsSent: 1 },
          lastContactedAt: new Date(),
          status: 'contacted',
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({
      message: 'Bulk emails sent successfully',
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending bulk emails', error: error.message });
  }
};

exports.getEmails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folder } = req.query;

    const filter = { userId };
    if (folder) filter.folder = folder;

    const emails = await Email.find(filter)
      .populate('leadId')
      .sort({ sentAt: -1 });

    res.json({
      count: emails.length,
      emails,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching emails', error: error.message });
  }
};

exports.getEmailById = async (req, res) => {
  try {
    const { emailId } = req.params;

    const email = await Email.findOne({
      _id: emailId,
      userId: req.user.id,
    }).populate('leadId');

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    if (!email.isRead && email.type === 'received') {
      email.isRead = true;
      await email.save();
    }

    res.json({ email });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching email', error: error.message });
  }
};

exports.saveDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, subject, body } = req.body;

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const draft = await Email.create({
      userId,
      from: userData.nexleadsEmail,
      to: to || '',
      subject: subject || '',
      body: body || '',
      type: 'draft',
      folder: 'drafts',
    });

    res.status(201).json({
      message: 'Draft saved',
      draft,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error saving draft', error: error.message });
  }
};

exports.deleteEmail = async (req, res) => {
  try {
    const { emailId } = req.params;

    const email = await Email.findOneAndDelete({
      _id: emailId,
      userId: req.user.id,
    });

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    res.json({
      message: 'Email permanently deleted',
      email,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting email', error: error.message });
  }
};

exports.moveToFolder = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { folder } = req.body;

    const email = await Email.findOneAndUpdate(
      { _id: emailId, userId: req.user.id },
      { folder },
      { new: true }
    );

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    res.json({
      message: 'Email moved successfully',
      email,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error moving email', error: error.message });
  }
};

exports.upsetEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { body, emailId } = req.body;

    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const email = await Email.findOneAndUpdate(
      { _id: emailId, userId: userId },
      { body },
      { new: true }
    );

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }
    const trackingPixel = `
        <img src="${process.env.API_BASE_URL}/user/open/${email._id}.png" style="display:none" />
      `;

    const formattedBody = formatEmailHtml(body);
    const replyAlias = getReplyAlias(email._id);

    const emailOptions = {
      from: `NexLeads <${process.env.SMTP_EMAIL}>`,
      replyTo: replyAlias,
      to: email.to,
      subject: email.subject,
      html: formattedBody + trackingPixel,
      headers: {
        'X-Entity-Ref-ID': email._id.toString(),
      }
    };

    if (email.inReplyTo) {
      emailOptions.headers['In-Reply-To'] = email.inReplyTo;
      emailOptions.headers['References'] = email.references ? email.references.join(' ') : email.inReplyTo;
    }

    const result = await sendEmail(emailOptions);
    await applySentMetadata(email, result, replyAlias);

    // Update lead stats
    if (email.leadId) {
      await Lead.findByIdAndUpdate(email.leadId, {
        $inc: { emailsSent: 1 },
        lastContactedAt: new Date(),
      });
    }

    res.status(201).json({
      message: "Email sent successfully",
      email,
    });
  } catch (error) {
    console.error("Compose email error:", error);
    res.status(500).json({
      message: "Error sending email",
      error: error.message,
    });
  }
};

// NEW: Poll Gmail for replies
exports.checkEmailReplies = async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await User.findById(userId);

    if (!userData) {
      return res.status(400).json({ message: "Gmail not connected" });
    }

    await fetchNewReplies(userData);

    res.status(200).json({ message: "Email replies synced successfully" });
  } catch (error) {
    console.error("Check email replies error:", error);
    res.status(500).json({
      message: "Error checking email replies",
      error: error.message,
    });
  }
};

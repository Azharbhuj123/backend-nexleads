
const Email = require('../models/Email');
const Lead = require('../models/Lead');
const { sendEmail, sendBulkEmails } = require('../utils/helper');
const { uploadToS3 } = require('../utils/s3Uploader');
exports.composeEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { to, subject, body, leadId } = req.body;

    let attachments = [];

    // Upload attachments to S3
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await uploadToS3(
          file.buffer,
          file.originalname
        );

        attachments.push({
          filename: file.originalname,
          url: fileUrl,
        });
      }
    }

    const emailData = {
      userId,
      leadId,
      from: req.user.nexleadsEmail,
      to,
      subject,
      body,
      attachments,
      type: "sent",
      folder: "sent",
    };

    const email = await Email.create(emailData);

    // Send actual email
    const emailOptions = {
      from: req.user.nexleadsEmail,
      to,
      subject,
      html: body,
      attachments: attachments.map(att => ({
        filename: att.filename,
        path: att.url, // S3 public URL
      })),
    };

    await sendEmail(emailOptions);

    // Update lead
    if (leadId) {
      await Lead.findByIdAndUpdate(leadId, {
        $inc: { emailsSent: 1 },
        lastContactedAt: new Date(),
        status: "contacted",
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

exports.sendBulkEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { recipients, subject, body } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients array is required' });
    }

    const emailPromises = recipients.map(recipient => ({
      from: req.user.nexleadsEmail,
      to: recipient.email,
      subject,
      html: body,
    }));

    const results = await sendBulkEmails(emailPromises);

    // Save emails to database
    const emailDocs = recipients.map(recipient => ({
      userId,
      leadId: recipient.leadId,
      from: req.user.nexleadsEmail,
      to: recipient.email,
      subject,
      body,
      type: 'sent',
      folder: 'sent',
    }));

    await Email.insertMany(emailDocs);

    // Update leads
    for (const recipient of recipients) {
      if (recipient.leadId) {
        await Lead.findByIdAndUpdate(recipient.leadId, {
          $inc: { emailsSent: 1 },
          lastContactedAt: new Date(),
          status: 'contacted',
        });
      }
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
    const userId = req.user._id;
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
      userId: req.user._id,
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
    const userId = req.user._id;
    const { to, subject, body } = req.body;

    const draft = await Email.create({
      userId,
      from: req.user.nexleadsEmail,
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

exports.moveToFolder = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { folder } = req.body;

    const email = await Email.findOneAndUpdate(
      { _id: emailId, userId: req.user._id },
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
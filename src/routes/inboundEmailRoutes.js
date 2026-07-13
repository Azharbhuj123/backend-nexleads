const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const Email = require('../models/email');
const Lead = require('../models/lead');
const FollowUp = require('../models/followup');

const router = express.Router();
const upload = multer();

const normalizeReferences = (references) => {
  if (!references) return [];
  if (Array.isArray(references)) return references;
  return String(references).split(/\s+/).filter(Boolean);
};

const verifyMailgunSignature = ({ timestamp, token, signature }) => {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey || !timestamp || !token || !signature) return false;

  const encoded = crypto
    .createHmac('sha256', signingKey)
    .update(String(timestamp).concat(String(token)))
    .digest('hex');

  const expected = Buffer.from(encoded, 'hex');
  const actual = Buffer.from(String(signature), 'hex');

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const getTrackedEmailId = (recipient = '') => {
  const aliasMatch = String(recipient).match(/reply\+([^@]+)@/i);
  return aliasMatch?.[1] || null;
};

const findOriginalEmail = async ({ trackedEmailId, inReplyTo }) => {
  if (trackedEmailId) {
    const originalEmail = await Email.findById(trackedEmailId);
    if (originalEmail) return originalEmail;
  }

  if (inReplyTo) {
    const originalEmail = await Email.findOne({
      $or: [
        { providerMessageId: inReplyTo },
        { messageId: inReplyTo },
      ],
    });

    if (originalEmail) return originalEmail;
  }

  return null;
};

router.post('/', upload.none(), async (req, res) => {
  const {
    sender,
    recipient,
    subject,
    timestamp,
    token,
    signature,
    References: references,
  } = req.body;

  const bodyText = req.body['body-plain'];
  const bodyHtml = req.body['body-html'];
  const messageId = req.body['Message-Id'] || req.body['message-id'];
  const inReplyTo = req.body['In-Reply-To'] || req.body['in-reply-to'];

  console.log('[Mailgun inbound] Incoming email:', { sender, recipient });

  if (!verifyMailgunSignature({ timestamp, token, signature })) {
    console.error('[Mailgun inbound] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    if (messageId) {
      const existingEmail = await Email.findOne({ providerMessageId: messageId });
      if (existingEmail) {
        console.log('[Mailgun inbound] Duplicate detected:', messageId);
        return res.status(200).json({ status: 'duplicate' });
      }
    }

    const trackedEmailId = getTrackedEmailId(recipient);
    const originalEmail = await findOriginalEmail({ trackedEmailId, inReplyTo });
    const matchStatus = originalEmail ? 'matched' : 'unmatched';

    console.log('[Mailgun inbound] Match result:', {
      matchStatus,
      originalEmailId: originalEmail?._id?.toString() || null,
    });

    const receivedEmail = await Email.create({
      userId: originalEmail?.userId || undefined,
      leadId: originalEmail?.leadId || undefined,
      followUpId: originalEmail?.followUpId || undefined,
      originalEmailId: originalEmail?._id || undefined,
      folder: 'inbox',
      type: 'received',
      from: sender || '',
      to: recipient || '',
      subject: subject || '(no subject)',
      body: bodyText || bodyHtml || '',
      providerMessageId: messageId || undefined,
      messageId: messageId || undefined,
      inReplyTo: inReplyTo || undefined,
      references: normalizeReferences(references),
      receivedAt: new Date(),
      sentAt: new Date(),
      threadId: originalEmail?.threadId || originalEmail?.providerMessageId || null,
      matchStatus,
      headers: {
        timestamp,
        token,
        signature,
      },
    });

    if (originalEmail?.leadId) {
      await Lead.findByIdAndUpdate(originalEmail.leadId, {
        $set: { status: 'responded' },
        $inc: { responses: 1 },
      });
      console.log('[Mailgun inbound] Lead updated:', originalEmail.leadId.toString());
    }

    if (originalEmail?.followUpId) {
      await FollowUp.findByIdAndUpdate(originalEmail.followUpId, {
        $inc: { repliesReceived: 1, responsesReceived: 1 },
      });
      console.log('[Mailgun inbound] Follow-up updated:', originalEmail.followUpId.toString());
    }

    return res.status(200).json({ status: 'ok', id: receivedEmail._id });
  } catch (err) {
    console.error('[Mailgun inbound] Error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/email');
const Lead = require('../models/lead');

async function fetchNewReplies(userData) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.SMTP_EMAIL,
      password: process.env.SMTP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const searchCriteria = [
          ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
        ];

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve();
          }

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (!err) {
                  await processIncomingEmail(parsed, userData);
                }
              });
            });
          });

          fetch.once('end', () => {
            imap.end();
            resolve();
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

async function processIncomingEmail(parsed, userData) {
  console.log("Incoming Email:", {
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references
  });

  const existingEmail = await Email.findOne({
    messageId: parsed.messageId
  });

  if (existingEmail)
    return;

  const from = parsed.from?.value?.[0]?.address;
  const to = parsed.to?.value?.[0]?.address;

  if (!from) return;

  let originalEmail = null;

  // Step 1: Match by inReplyTo
  if (parsed.inReplyTo) {
    originalEmail = await Email.findOne({
      messageId: parsed.inReplyTo
    });
  }

  // Step 2: Match by references
  if (!originalEmail && parsed.references) {
    originalEmail = await Email.findOne({
      messageId: {
        $in: parsed.references
      }
    });
  }

  // Step 3: Fallback by sender email
  if (!originalEmail) {
    originalEmail = await Email.findOne({
      userId: userData._id,
      to: from,
      type: 'sent'
    }).sort({ sentAt: -1 });
  }

  let lead = null;

  if (originalEmail?.leadId) {
    lead = await Lead.findById(originalEmail.leadId);
  }

  if (!lead) {
    lead = await Lead.findOne({
      userId: userData._id,
      email: from
    });
  }

  await Email.create({
    userId: userData._id,
    leadId: lead?._id || null,
    from,
    to,
    subject: parsed.subject,
    body: parsed.html || parsed.text,
    type: 'received',
    folder: 'inbox',
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references || [],
    threadId: originalEmail?.threadId || originalEmail?.messageId || parsed.messageId,
    sentAt: parsed.date || new Date(),
  });

  if (lead) {
    lead.responses = (lead.responses || 0) + 1;
    lead.status = 'responded';
    await lead.save();
  }
}

module.exports = {
  fetchNewReplies,
};

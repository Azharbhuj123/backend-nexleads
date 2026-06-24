const nodemailer = require("nodemailer");

const ResponseObj = {
  status: null,
  data: null,
  message: "",
  error: "",
};
module.exports.sendResponse = (status, data, message, error) => {
  ResponseObj.status = status;
  ResponseObj.data = data;
  ResponseObj.message = message;
  ResponseObj.error = error;
  return ResponseObj;
};
 
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 587, false for other ports
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});
module.exports.transporter = transporter;

const COMMON_HTML_TAG_PATTERN = /<\/?(?:a|b|blockquote|br|div|em|h[1-6]|i|li|ol|p|span|strong|table|tbody|td|th|thead|tr|u|ul)(?:\s[^>]*)?>/i;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const preserveSpaces = (value) =>
  escapeHtml(value.replace(/\t/g, "    ")).replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));

const renderParagraph = (lines) => `<p>${lines.map(preserveSpaces).join("<br>")}</p>`;

const renderList = (type, items) => {
  if (!items.length) return "";
  return `<${type}>${items.map((item) => `<li>${preserveSpaces(item)}</li>`).join("")}</${type}>`;
};

const flushList = (blocks, listType, listItems) => {
  if (listType && listItems.length) {
    blocks.push(renderList(listType, listItems));
  }
};

exports.formatEmailHtml = (body = "") => {
  const rawBody = String(body);

  if (COMMON_HTML_TAG_PATTERN.test(rawBody)) {
    return rawBody;
  }

  const lines = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listType = null;
  let listItems = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push(renderParagraph(paragraphLines));
      paragraphLines = [];
    }
  };

  const startOrContinueList = (type, content) => {
    flushParagraph();

    if (listType && listType !== type) {
      flushList(blocks, listType, listItems);
      listItems = [];
    }

    listType = type;
    listItems.push(content);
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList(blocks, listType, listItems);
      listType = null;
      listItems = [];
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*\u2022]\s+(.+)$/);
    if (unorderedMatch) {
      startOrContinueList("ul", unorderedMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      startOrContinueList("ol", orderedMatch[1]);
      continue;
    }

    flushList(blocks, listType, listItems);
    listType = null;
    listItems = [];
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList(blocks, listType, listItems);

  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">${blocks.join("")}</div>`;
};

exports.sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html || options.text,
      attachments: options.attachments || [],
      headers: options.headers || {},
      replyTo: options.replyTo || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

exports.sendBulkEmails = async (emails) => {
  const results = [];
  
  for (const email of emails) {
    const result = await exports.sendEmail(email);
    results.push(result);
    
    // Add delay to avoid spam triggers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
};

exports.generateNexleadsEmail = (name) => {
  const username = name.toLowerCase().replace(/\s+/g, '');
  const randomNum = Math.floor(Math.random() * 1000);
  return `${username}${randomNum}@nexleads.com`;
};

module.exports.generateRandomPassword=(length = 8)=> {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}<>?';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

module.exports.paginateData = async (
  model,
  page = 1,
  limit = 10,
  query = {},
  fields = null,
  populateOptions = [],
  noSort=false
) => {
  try {
    const skip = (page - 1) * limit;
    let sortquery = { createdAt: -1 }
    if(noSort) sortquery = {};
    
    // Start the query with the provided model and query
    let queryBuilder = model.find(query).select(fields).sort(sortquery).skip(skip).limit(limit);
    // populateOptions should look like this:
    // const populateOptions = [
    //   {
    //     path: 'category',  // Reference field
    //     select: 'name description' // Only select the mentioned feilds from path model
    //   }
    // ];

    // Apply population if populateOptions are provided
    if (populateOptions?.length > 0) {
      populateOptions?.forEach((option) => {
        queryBuilder = queryBuilder?.populate(option);
      });
    };
    const data = await queryBuilder;
    const totalCount = await model.countDocuments(query);
    const result = {
      status: true,
      data,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit) || 1,
      totalItems: totalCount,
    };
    return result;
  } catch (error) {
    throw new Error("Pagination error: " + error.message);
  }
};


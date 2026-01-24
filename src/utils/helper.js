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
 
module.exports.transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for port 587, false for other ports
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

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


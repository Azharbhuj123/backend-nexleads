const Joi = require("joi");
const {
  authRoles,
  appointmentTypes,
  payMethodTypes,
  deliveryHours,
  days,
  status,
  campaignType,
} = require("./enums");

module.exports.registerValidation = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().length(8).required(),
  role: Joi.string().valid(authRoles[0]).optional(),
});

module.exports.orderValidation = Joi.object({
  user: Joi.string().optional(),
  cartIds: Joi.array().optional(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  home: Joi.string().required(),
  floorNo: Joi.string().required(),
  phonenumber: Joi.string().required(),
  postalCode: Joi.number().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().required(),
        mealType: Joi.string().required(),
        qty: Joi.number().integer().min(1).required(),
        price: Joi.number().min(1).required(),
      })
    )
    .min(1)
    .required(),

  deliveryHours: Joi.string()
    .valid(...deliveryHours)
    .required(),

  deliveryDay: Joi.string().required(),
  deliveryDate: Joi.string().required(),

  note: Joi.string().allow("").optional(),
  instructions: Joi.string().allow("").optional(),
  payMethod: Joi.string()
    .valid(...payMethodTypes)
    .required(),
  total: Joi.number().min(1).required(),
  isReTaken: Joi.boolean().required(),
});

module.exports.aboutUsValidation = Joi.object({
  firstname: Joi.string().trim().min(2).max(50).required(),
  lastname: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phonenumber: Joi.string().required(),

  message: Joi.string().trim().min(5).max(1000).required(),
});

module.exports.addToCartValidation = Joi.object({
  product: Joi.string().required(),
  qty: Joi.number().integer().min(1).required(),
  price: Joi.number().min(1).required(),
  discount: Joi.number().optional(),
});


module.exports.campaignValidation = Joi.object({
  name: Joi.string().required(),
  discount: Joi.number().required(),
  description: Joi.string().required(),
  redemCode: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  status: Joi.string().valid(...status).default(status[1]),
  type: Joi.string().valid(...campaignType).default(campaignType[0]),
});

const { body, validationResult } = require('express-validator');

exports.checkLeadsLimit = async (req, res, next) => {
  try {
    const user = req.user;

    // Check if reset date has passed
    if (new Date() >= user.subscription.resetDate) {
      user.subscription.leadsUsed = 0;
      user.subscription.resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await user.save();
    }

    if (user.subscription.leadsUsed >= user.subscription.leadsLimit) {
      return res.status(403).json({
        message: 'Lead limit reached for this month. Please upgrade your plan.',
        leadsUsed: user.subscription.leadsUsed,
        leadsLimit: user.subscription.leadsLimit,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking plan limits', error: error.message });
  }
};

exports.checkBulkEmailAccess = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.subscription.plan === 'free') {
      return res.status(403).json({
        message: 'Bulk email feature is not available in Free plan. Please upgrade to Pro or Platinum.',
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking plan access', error: error.message });
  }
};

exports.validateEmail = [
  body('to').isEmail().withMessage('Valid recipient email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('body').notEmpty().withMessage('Email body is required'),
];

exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const User = require('../models/user');
const Subscription = require('../models/subscription');
const bcrypt = require('bcryptjs');
const { uploadToS3 } = require('../utils/s3Uploader');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.updatePersonalInfo = async (req, res) => {
  try {
    const { name, bio } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (bio) updates.bio = bio;
   

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');

    res.json({
      message: 'Personal information updated',
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating personal info', error: error.message });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to S3
    const imageUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname
    );

    // Update user profile picture
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: imageUrl },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile picture updated",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("S3 upload error:", error);
    res.status(500).json({
      message: "Error uploading profile picture",
      error: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
};
exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        leadsLimit: 30,
        features: [
          '30 leads/month',
          'Basic email templates',
          'Limited follow-up tracking'
        ]
      },
      {
        id: 'pro',
        name: 'Pro',
        monthlyPrice: 29,
        annualPrice: 295, // 29 * 12 * 0.85
        leadsLimit: 100,
        features: [
          '100 leads/month',
          'Custom email sequences',
          'Advanced analytics',
          'Priority support'
        ]
      },
      {
        id: 'platinum',
        name: 'Platinum',
        monthlyPrice: 99,
        annualPrice: 1009, // 99 * 12 * 0.85
        leadsLimit: -1, // Unlimited
        features: [
          'Unlimited leads',
          'Everything in Pro',
          'API access',
          'Team collaboration',
          'Dedicated account manager',
          'Custom integrations'
        ]
      }
    ];

    res.json({ plans });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ 
      message: 'Error fetching subscription plans', 
      error: error.message 
    });
  }
};

// Create Payment Intent (Step 1 - Called from frontend before showing payment form)
exports.createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, billingCycle } = req.body;

    // Plan pricing
    const planPricing = {
      free: { monthly: 0, annual: 0 },
      pro: { monthly: 29, annual: 295 },
      platinum: { monthly: 99, annual: 1009 }
    };

    if (!planPricing[plan]) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    const amount = billingCycle === 'annually' 
      ? planPricing[plan].annual 
      : planPricing[plan].monthly;

    // Free plan doesn't need payment
    if (amount === 0) {
      return res.status(400).json({ 
        message: 'Free plan does not require payment' 
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString()
        }
      });
      customerId = customer.id;
      
      // Save Stripe customer ID to user
      await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId: userId.toString(),
        plan: plan,
        billingCycle: billingCycle
      },
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ${billingCycle}`,
      automatic_payment_methods: {
        enabled: true,
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      message: 'Error creating payment intent', 
      error: error.message 
    });
  }
};

// Confirm Payment and Update Subscription (Step 2 - Called after Stripe confirms payment)
exports.updateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, paymentIntentId, billingCycle } = req.body;

    const planDetails = {
      free: { leadsLimit: 30, price: 0 },
      pro: { leadsLimit: 100, monthlyPrice: 29, annualPrice: 295 },
      platinum: { leadsLimit: -1, monthlyPrice: 99, annualPrice: 1009 }
    };

    if (!planDetails[plan]) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    let paymentMethod = null;
    let transactionId = null;
    let price = planDetails[plan].price || 0;

    // For paid plans, verify payment with Stripe
    if (plan !== 'free') {
      if (!paymentIntentId) {
        return res.status(400).json({ 
          message: 'Payment Intent ID is required for paid plans' 
        });
      }

      try {
        // Retrieve Payment Intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verify payment succeeded
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ 
            message: 'Payment not completed',
            code: 'payment_incomplete',
            status: paymentIntent.status
          });
        }

        // Verify it belongs to this user
        if (paymentIntent.metadata.userId !== userId.toString()) {
          return res.status(403).json({ 
            message: 'Payment Intent does not belong to this user' 
          });
        }

        // Get payment method details
        if (paymentIntent.payment_method) {
          const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
          
          paymentMethod = pm.type
        }

        transactionId = paymentIntent.id;
        price = billingCycle === 'annually' 
          ? planDetails[plan].annualPrice 
          : planDetails[plan].monthlyPrice;

      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError);
        
        // Handle specific Stripe errors
        if (stripeError.type === 'StripeCardError') {
          return res.status(402).json({
            code: 'card_error',
            message: stripeError.message
          });
        }
        
        return res.status(500).json({ 
          message: 'Error verifying payment',
          error: stripeError.message 
        });
      }
    }

    // Calculate subscription end date
    const subscriptionDays = billingCycle === 'annually' ? 365 : 30;
    const endDate = new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000);

    // Create subscription record
    const subscriptionRecord = await Subscription.create({
      userId,
      plan,
      price,
      paymentMethod,
      transactionId,
      billingCycle: billingCycle || 'monthly',
      startDate: new Date(),
      endDate: endDate,
      status: 'active'
    });

    // Update user subscription
    const user = await User.findByIdAndUpdate(
      userId,
      {
        'subscription.plan': plan,
        'subscription.leadsLimit': planDetails[plan].leadsLimit,
        'subscription.leadsUsed': 0,
        'subscription.resetDate': endDate,
        'subscription.status': 'active'
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Subscription updated successfully',
      subscription: user.subscription,
      subscriptionRecord: {
        id: subscriptionRecord._id,
        plan: subscriptionRecord.plan,
        endDate: subscriptionRecord.endDate,
        transactionId: subscriptionRecord.transactionId
      }
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ 
      message: 'Error updating subscription', 
      error: error.message 
    });
  }
};

// Get Subscription History
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const history = await Subscription.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      history
    });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ 
      message: 'Error fetching subscription history', 
      error: error.message 
    });
  }
};

// Cancel Subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    // Update user to free plan
    const user = await User.findByIdAndUpdate(
      userId,
      {
        'subscription.plan': 'free',
        'subscription.leadsLimit': 30,
        'subscription.status': 'cancelled'
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark current subscription as cancelled
    await Subscription.findOneAndUpdate(
      { userId, status: 'active' },
      { 
        status: 'cancelled',
        cancelledAt: new Date()
      }
    );

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: user.subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ 
      message: 'Error cancelling subscription', 
      error: error.message 
    });
  }
};


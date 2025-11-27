const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/subscription.model.js');
const Payment = require('../models/payment.model.js');
const User = require('../models/user.model.js');

// @desc    Create Stripe checkout session
// @route   POST /api/payments/create-checkout-session
// @access  Private/Resident
const createCheckoutSession = async (req, res) => {
  const { plan } = req.body; // 'monthly' or 'yearly'
  const residentId = req.user._id;

  const YOUR_DOMAIN = process.env.CLIENT_URL || 'http://localhost:5173'; // Your frontend URL

  let priceId;
  let amount;
  let interval;

  if (plan === 'monthly') {
    priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    amount = 1000; // This should ideally be derived from Stripe Price object
    interval = 'month';
  } else if (plan === 'yearly') {
    priceId = process.env.STRIPE_YEARLY_PRICE_ID;
    amount = 10000; // This should ideally be derived from Stripe Price object
    interval = 'year';
  } else {
    return res.status(400).json({ message: 'Invalid plan specified' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Track My Trash - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            },
            unit_amount: amount,
            recurring: {
              interval: interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${YOUR_DOMAIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/payment/cancel`,
      metadata: {
        residentId: residentId.toString(),
        plan: plan,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
};

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
// @access  Public (Stripe only)
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout session completed:', session);

      const { residentId, plan } = session.metadata;
      const paymentId = session.id;
      const amount = session.amount_total;
      const currency = session.currency;
      const subscriptionId = session.subscription; // Stripe subscription ID

      try {
        // Create new Subscription in your DB
        const startDate = new Date();
        let endDate = new Date();
        if (plan === 'monthly') {
          endDate.setMonth(startDate.getMonth() + 1);
        } else if (plan === 'yearly') {
          endDate.setFullYear(startDate.getFullYear() + 1);
        }

        const newSubscription = await Subscription.create({
          resident: residentId,
          plan,
          startDate,
          endDate,
          status: 'active',
          stripeSubscriptionId: subscriptionId, // Store Stripe's subscription ID
        });

        // Create new Payment record
        await Payment.create({
          resident: residentId,
          subscription: newSubscription._id,
          amount: amount / 100, // Convert cents to dollars
          paymentId: paymentId,
          status: 'completed',
        });

        // Update user's subscription status if needed
        await User.findByIdAndUpdate(residentId, { isSubscribed: true });

        console.log('Subscription and Payment recorded for resident:', residentId);
      } catch (error) {
        console.error('Error processing checkout.session.completed:', error);
        // It's best practice for webhooks to return 200 even on internal errors
        // to prevent Stripe from retrying the event. Handle error logging internally.
        return res.status(200).json({ received: true, error: 'Error processing event' });
      }
      break;
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Invoice payment succeeded:', invoice);
      // Handle recurring payment success for subscriptions
      // You might update payment records, check subscription status etc.
      break;
    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object;
      console.log('Customer subscription deleted:', subscriptionDeleted);
      // Handle subscription cancellation/deletion
      // Find your subscription by stripeSubscriptionId and mark as cancelled/expired
      try {
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionDeleted.id },
          { status: 'cancelled', endDate: new Date() }
        );
        console.log('Subscription marked as cancelled for stripeSubscriptionId:', subscriptionDeleted.id);
      } catch (error) {
        console.error('Error handling customer.subscription.deleted:', error);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
};


module.exports = {
  createCheckoutSession,
  stripeWebhook,
};
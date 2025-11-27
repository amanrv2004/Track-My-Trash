const express = require('express');
const router = express.Router();
const { createCheckoutSession, stripeWebhook } = require('../controllers/payment.controller.js');
const { protect, resident } = require('../middleware/auth.middleware.js');

// This route is for creating checkout sessions (protected for residents)
router.post('/create-checkout-session', protect, resident, createCheckoutSession);

// This route is for Stripe webhooks (public, Stripe will call this)
// It needs to be raw body, so place it before express.json() if used globally
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

module.exports = router;

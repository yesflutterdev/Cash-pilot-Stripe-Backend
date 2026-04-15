import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// ==================== CUSTOMER ENDPOINTS ====================

// Create a new customer
app.post('/api/create-customer', async (req, res) => {
  try {
    const { email, name, phone, description } = req.body;
    
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      description: description || 'Customer from mobile app',
      metadata: {
        created_from: 'mobile_app'
      }
    });
    
    res.json({
      success: true,
      customerId: customer.id,
      customer
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get customer details
app.get('/api/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await stripe.customers.retrieve(customerId);
    
    res.json({ success: true, customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== PAYMENT INTENT ENDPOINTS ====================

// Create a payment intent (one-time payment)
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, customerId, paymentMethodId, description } = req.body;
    
    const paymentIntentData = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency || 'usd',
      description: description || 'Payment from mobile app',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    };
    
    // Add customer if provided
    if (customerId) {
      paymentIntentData.customer = customerId;
    }
    
    // Add payment method if provided (for immediate confirmation)
    if (paymentMethodId) {
      paymentIntentData.payment_method = paymentMethodId;
      paymentIntentData.confirm = true;
      paymentIntentData.return_url = req.body.return_url || 'https://your-app.com/return';
    }
    
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Confirm a payment intent
app.post('/api/confirm-payment-intent', async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId
    });
    
    res.json({
      success: true,
      status: paymentIntent.status,
      paymentIntent
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get payment intent status
app.get('/api/payment-intent/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    res.json({ success: true, paymentIntent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== RECURRING PAYMENT (SUBSCRIPTION) ENDPOINTS ====================

// Create a subscription product and price
app.post('/api/create-product', async (req, res) => {
  try {
    const { name, description, amount, currency, interval, intervalCount } = req.body;
    
    // Create product
    const product = await stripe.products.create({
      name: name || 'Subscription Product',
      description: description || 'Recurring payment product'
    });
    
    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: currency || 'usd',
      recurring: {
        interval: interval || 'month', // 'day', 'week', 'month', 'year'
        interval_count: intervalCount || 1
      }
    });
    
    res.json({
      success: true,
      productId: product.id,
      priceId: price.id,
      product,
      price
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create subscription for customer
app.post('/api/create-subscription', async (req, res) => {
  try {
    const { customerId, priceId, paymentMethodId, trialPeriodDays } = req.body;
    
    if (!customerId || !priceId) {
      throw new Error('customerId and priceId are required');
    }
    
    // Attach payment method to customer if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    // Create subscription
    const subscriptionData = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    };
    
    // Add trial period if specified
    if (trialPeriodDays) {
      subscriptionData.trial_period_days = trialPeriodDays;
    }
    
    const subscription = await stripe.subscriptions.create(subscriptionData);
    
    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      status: subscription.status,
      subscription
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Cancel subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId, cancelAtPeriodEnd } = req.body;
    
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd !== false // Default true
    });
    
    res.json({
      success: true,
      message: cancelAtPeriodEnd !== false ? 
        'Subscription will be cancelled at period end' : 
        'Subscription cancelled immediately',
      subscription
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get subscription details
app.get('/api/subscription/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update subscription (change plan, quantity, etc.)
app.post('/api/update-subscription', async (req, res) => {
  try {
    const { subscriptionId, newPriceId, quantity, cancelAtPeriodEnd } = req.body;
    
    const updateData = {};
    
    if (newPriceId) {
      updateData.items = [{
        id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
        price: newPriceId
      }];
    }
    
    if (quantity) {
      updateData.quantity = quantity;
    }
    
    if (cancelAtPeriodEnd !== undefined) {
      updateData.cancel_at_period_end = cancelAtPeriodEnd;
    }
    
    const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
    
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== PAYMENT METHOD ENDPOINTS ====================

// Save payment method for customer
app.post('/api/save-payment-method', async (req, res) => {
  try {
    const { customerId, paymentMethodId, setAsDefault } = req.body;
    
    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Optionally set as default payment method
    if (setAsDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    res.json({ success: true, paymentMethod });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get customer's payment methods
app.get('/api/payment-methods/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { type } = req.query;
    
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: type || 'card',
    });
    
    res.json({ success: true, paymentMethods });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete payment method
app.delete('/api/payment-method/:paymentMethodId', async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    
    res.json({ success: true, message: 'Payment method detached', paymentMethod });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== WEBHOOK ENDPOINTS ====================

// Webhook for subscription events
// app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
//   let event;
  
//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
//   } catch (err) {
//     console.log(`Webhook signature verification failed: ${err.message}`);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }
  
//   // Handle the event
//   switch (event.type) {
//     case 'customer.subscription.created':
//       const subscriptionCreated = event.data.object;
//       console.log(`Subscription created: ${subscriptionCreated.id}`);
//       // Handle subscription creation (send email, update local state, etc.)
//       break;
      
//     case 'customer.subscription.updated':
//       const subscriptionUpdated = event.data.object;
//       console.log(`Subscription updated: ${subscriptionUpdated.id}`);
//       break;
      
//     case 'customer.subscription.deleted':
//       const subscriptionDeleted = event.data.object;
//       console.log(`Subscription cancelled: ${subscriptionDeleted.id}`);
//       break;
      
//     case 'invoice.payment_succeeded':
//       const invoice = event.data.object;
//       console.log(`Payment succeeded for invoice: ${invoice.id}`);
//       break;
      
//     case 'invoice.payment_failed':
//       const failedInvoice = event.data.object;
//       console.log(`Payment failed for invoice: ${failedInvoice.id}`);
//       break;
      
//     case 'payment_intent.succeeded':
//       const paymentIntent = event.data.object;
//       console.log(`Payment succeeded: ${paymentIntent.id}`);
//       break;
      
//     default:
//       console.log(`Unhandled event type: ${event.type}`);
//   }
  
//   res.json({ received: true });
// });

// ==================== REFUND ENDPOINTS ====================

// Create refund
app.post('/api/refund', async (req, res) => {
  try {
    const { paymentIntentId, amount, reason } = req.body;
    
    const refundData = {
      payment_intent: paymentIntentId,
    };
    
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }
    
    if (reason) {
      refundData.reason = reason; // 'duplicate', 'fraudulent', 'requested_by_customer'
    }
    
    const refund = await stripe.refunds.create(refundData);
    
    res.json({ success: true, refund });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== SIMPLE ONE-TIME PAYMENT WITH CARD DETAILS ====================

// Process payment directly with card details (for testing)
app.post('/api/process-payment', async (req, res) => {
  try {
    const { amount, currency, token, customerId, description } = req.body;
    
    const paymentData = {
      amount: Math.round(amount * 100),
      currency: currency || 'usd',
      description: description || 'Payment from mobile app',
      confirm: true,
      payment_method_data: {
        type: 'card',
        card: {
          token: token
        }
      }
    };
    
    if (customerId) {
      paymentData.customer = customerId;
    }
    
    const paymentIntent = await stripe.paymentIntents.create(paymentData);
    
    res.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add this to your server.js file

// ==================== SAVE CARDS (SETUP INTENT) ====================

// Create setup intent for saving card (no charge)
app.post('/api/save-card-setup', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;
    
    let customer = customerId;
    
    // If no customer ID provided, create a new customer
    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        description: 'Customer saving card for future payments'
      });
      customer = newCustomer.id;
    }
    
    const setupIntent = await stripe.setupIntents.create({
      customer: customer,
      payment_method_types: ['card'],
      usage: 'off_session', // Allows future payments without customer interaction
      return_url: returnUrl || 'https://your-app.com/setup-complete'
    });
    
    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      customerId: customer,
      setupIntentId: setupIntent.id
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Alternative: Save card by attaching to existing customer
app.post('/api/attach-payment-method', async (req, res) => {
  try {
    const { customerId, paymentMethodId, setAsDefault } = req.body;
    
    if (!customerId || !paymentMethodId) {
      throw new Error('customerId and paymentMethodId are required');
    }
    
    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method if requested
    if (setAsDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    res.json({
      success: true,
      paymentMethodId: paymentMethod.id,
      card: {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== GET SAVED CARDS ====================

// Get all saved cards for a customer
app.get('/api/saved-cards/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get all payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    
    // Format the response
    const cards = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      is_default: pm.metadata?.is_default === 'true' || false,
      created: pm.created
    }));
    
    // Get default payment method from customer settings
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
    
    // Mark default card
    if (defaultPaymentMethodId) {
      const defaultCard = cards.find(card => card.id === defaultPaymentMethodId);
      if (defaultCard) {
        defaultCard.is_default = true;
      }
    }
    
    res.json({
      success: true,
      cards: cards,
      defaultCardId: defaultPaymentMethodId
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get specific card details
app.get('/api/card-details/:customerId/:paymentMethodId', async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.params;
    
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    // Verify this payment method belongs to the customer
    if (paymentMethod.customer !== customerId) {
      throw new Error('Payment method does not belong to this customer');
    }
    
    res.json({
      success: true,
      card: {
        id: paymentMethod.id,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
        fingerprint: paymentMethod.card.fingerprint
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Set default card for customer
app.post('/api/set-default-card', async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;
    
    // Update customer's default payment method
    const customer = await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    res.json({
      success: true,
      message: 'Default card updated successfully',
      defaultCardId: paymentMethodId
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete saved card
app.delete('/api/delete-card/:customerId/:paymentMethodId', async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.params;
    
    // Detach the payment method
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    
    res.json({
      success: true,
      message: 'Card deleted successfully',
      paymentMethodId: paymentMethodId
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== RECURRING PAYMENTS WITH DIFFERENT INTERVALS ====================

// Create subscription with specific interval
app.post('/api/create-recurring-payment', async (req, res) => {
  try {
    const {
      customerId,
      paymentMethodId,
      amount,
      currency,
      interval, // 'day', 'week', 'month', 'year'
      intervalCount,
      productName,
      trialDays,
      numberOfPayments // Optional: for fixed number of payments
    } = req.body;
    
    if (!customerId || !amount || !interval) {
      throw new Error('customerId, amount, and interval are required');
    }
    
    // Create or get product
    let product;
    const existingProducts = await stripe.products.search({
      query: `name:'${productName || `${interval}ly subscription`}' AND active:'true'`
    });
    
    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
    } else {
      product = await stripe.products.create({
        name: productName || `${interval}ly Subscription`,
        description: `${intervalCount || 1} ${interval}${(intervalCount || 1) > 1 ? 's' : ''} recurring payment`
      });
    }
    
    // Create price with specific interval
    const priceData = {
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: currency || 'usd',
      recurring: {
        interval: interval, // 'day', 'week', 'month', 'year'
        interval_count: intervalCount || 1
      }
    };
    
    // Add payment count limit if specified
    if (numberOfPayments) {
      priceData.recurring.metadata = {
        number_of_payments: numberOfPayments
      };
    }
    
    const price = await stripe.prices.create(priceData);
    
    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    // Create subscription
    const subscriptionData = {
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    };
    
    // Add trial days if specified
    if (trialDays && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }
    
    const subscription = await stripe.subscriptions.create(subscriptionData);
    
    res.json({
      success: true,
      subscriptionId: subscription.id,
      priceId: price.id,
      productId: product.id,
      interval: interval,
      intervalCount: intervalCount || 1,
      amount: amount,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      trialEnd: subscription.trial_end
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create multiple price options (for different plans)
app.post('/api/create-price-plans', async (req, res) => {
  try {
    const { productName, plans } = req.body;
    
    // Create product
    const product = await stripe.products.create({
      name: productName,
      description: 'Subscription with multiple billing intervals'
    });
    
    // Create prices for each plan
    const prices = [];
    for (const plan of plans) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(plan.amount * 100),
        currency: plan.currency || 'usd',
        recurring: {
          interval: plan.interval, // 'week', 'month', 'year'
          interval_count: plan.intervalCount || 1
        },
        metadata: {
          plan_name: plan.name,
          display_order: plan.order || 0
        }
      });
      
      prices.push({
        id: price.id,
        name: plan.name,
        interval: plan.interval,
        intervalCount: plan.intervalCount || 1,
        amount: plan.amount,
        currency: plan.currency || 'usd'
      });
    }
    
    res.json({
      success: true,
      productId: product.id,
      productName: product.name,
      prices: prices
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Switch between different intervals for existing subscription
app.post('/api/change-subscription-interval', async (req, res) => {
  try {
    const { subscriptionId, newInterval, newIntervalCount, newAmount, currency } = req.body;
    
    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Create new price with different interval
    const newPrice = await stripe.prices.create({
      product: subscription.items.data[0].price.product,
      unit_amount: Math.round(newAmount * 100),
      currency: currency || 'usd',
      recurring: {
        interval: newInterval, // 'day', 'week', 'month', 'year'
        interval_count: newIntervalCount || 1
      }
    });
    
    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPrice.id,
      }],
      proration_behavior: 'create_prorations'
    });
    
    res.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      newInterval: newInterval,
      newAmount: newAmount,
      updatedSubscription
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get customer's active subscriptions with details
app.get('/api/customer-subscriptions/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.default_payment_method', 'data.plan.product']
    });
    
    const formattedSubscriptions = subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialStart: sub.trial_start,
      trialEnd: sub.trial_end,
      items: sub.items.data.map(item => ({
        priceId: item.price.id,
        amount: item.price.unit_amount / 100,
        currency: item.price.currency,
        interval: item.price.recurring.interval,
        intervalCount: item.price.recurring.interval_count,
        productName: item.price.product.name
      })),
      defaultPaymentMethod: sub.default_payment_method ? {
        brand: sub.default_payment_method.card?.brand,
        last4: sub.default_payment_method.card?.last4
      } : null
    }));
    
    res.json({
      success: true,
      subscriptions: formattedSubscriptions
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Stripe backend running on port ${PORT}`);
//   console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
// });


app.listen(PORT, () => {
  console.log(`🚀 Stripe backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
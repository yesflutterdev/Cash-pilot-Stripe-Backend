# Stripe Backend API for Flutter Apps

A complete, database-free Stripe backend built with Node.js and Express. Perfect for Flutter mobile applications needing payment processing, card management, and recurring subscriptions.

## 🚀 Features

- ✅ **One-time Payments** - Process single payments
- ✅ **Card Management** - Save, list, delete, and manage user cards
- ✅ **Recurring Payments** - Weekly, monthly, yearly, and custom intervals
- ✅ **Subscription Management** - Create, update, cancel, and change plans
- ✅ **Customer Management** - Create and manage customers
- ✅ **Refunds** - Process full or partial refunds
- ✅ **Webhooks** - Handle Stripe events
- ✅ **No Database** - Stripe is your source of truth

## 📋 Prerequisites

- Node.js (v14 or higher)
- Stripe Account (https://stripe.com)
- Stripe API Keys (Test/Live)

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd stripe-backend
```

# Base URL

```
Development: http://localhost:3000
Production:  https://your-domain.com
```

# 👤 Customer Management Routes

## 1-

`POST /api/create-customer`

Create a new customer in Stripe to associate payments and subscriptions with.

**When to use:**

- When a user signs up for your app for the first time

- Before saving any payment methods or creating subscriptions

- To group multiple payment methods under one user

**Request Body:**

```
{
  "email": "user@example.com",      // Required: User's email
  "name": "John Doe",                // Optional: User's full name
  "phone": "+1234567890",            // Optional: User's phone number
  "description": "Premium user"      // Optional: Internal notes
}
```

Response: Returns customer ID and full customer object

```
{
  "success": true,
  "customerId": "cus_xxxxxxxxxxxxx",
  "customer": { ... }
}
```

Usage Example: Call this when a new user registers in your app. Store the returned customerId in your app's local storage or user session.

## 2-

`GET /api/customer/:customerId`
Retrieve existing customer details.

When to use:

- To verify a customer exists
- To get customer's default payment method
- To display customer information in app settings

URL Parameters: customerId - The Stripe customer ID

Response: Returns complete customer object including default payment method, email, metadata, etc.

# 💳 Card Management Routes

## 3-

`POST /api/save-card-setup`
Purpose: Create a setup intent to securely save a customer's card without charging it.

When to use:

- When a user wants to save their card for future purchases
- Before creating a subscription (to have a payment method ready)

- When adding a new card to existing payment methods

Request Body:

```
{
  "customerId": "cus_xxxxxxxxxxxxx",  // Optional: Creates new customer if omitted
  "returnUrl": "https://your-app.com/setup-complete"  // Optional: Where Stripe redirects after setup
}
```

Response:

```
{
  "success": true,
  "clientSecret": "seti_xxx_secret_xxx",  // Send this to your mobile app
  "customerId": "cus_xxxxxxxxxxxxx",
  "setupIntentId": "seti_xxxxxxxxxxxxx"
}
```

Usage Flow:

- Call this endpoint from your mobile app
- Get clientSecret in response
- Use Stripe SDK on mobile with this clientSecret to collect card details
- Stripe securely saves the card and returns a paymentMethodId

## 4-

`POST /api/attach-payment-method`

Attach a payment method (card) to a customer after it's been collected via setup intent.

When to use:

- After successfully saving a card using Stripe SDK
- To add a card that was created through other means
- To set a card as default after attaching

Request Body:

```
{
  "customerId": "cus_xxxxxxxxxxxxx",     // Required: Customer to attach card to
  "paymentMethodId": "pm_xxxxxxxxxxxxx", // Required: Card identifier from Stripe SDK
  "setAsDefault": true                    // Optional: Make this the default card
}
```

Response: Returns attached payment method with card details

```
{
  "success": true,
  "paymentMethodId": "pm_xxxxxxxxxxxxx",
  "card": {
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2025
  }
}
```

Usage Flow:

- After mobile app gets paymentMethodId from Stripe SDK
- Call this endpoint to associate that card with the customer
- Card is now saved and can be used for future payments

## 5-

`GET /api/saved-cards/:customerId`

Retrieve all saved cards for a customer.

When to use:

- Displaying saved cards in payment selection screen
- Letting user choose which card to use for payment
- Showing card list in app settings for management

URL Parameters: customerId - The customer's Stripe ID

Response:

```
{
  "success": true,
  "cards": [
    {
      "id": "pm_xxxxxxxxxxxxx",
      "brand": "visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2025,
      "is_default": true,
      "created": 1699123456
    }
  ],
  "defaultCardId": "pm_xxxxxxxxxxxxx"
}
```

Usage Example: Call this when navigating to payment screen to show user their saved cards.

## 6-

`GET /api/card-details/:customerId/:paymentMethodId`

Get detailed information about a specific saved card.

When to use:

- When user wants to see full details of a card
- Before processing a payment to verify card information
- For debugging or logging purposes

URL Parameters:

- customerId - The customer's Stripe ID
- paymentMethodId - The specific card's ID

Response: Returns detailed card information including fingerprint for fraud detection

## 7-

`POST /api/set-default-card`

Set a specific card as the default payment method for a customer.

When to use:

- User selects a different card as their primary payment method
- After adding a new card, user wants to make it default
- When migrating from one card to another

Request Body:

```
{
  "customerId": "cus_xxxxxxxxxxxxx",
  "paymentMethodId": "pm_xxxxxxxxxxxxx"
}
```

Response: Confirms default card has been updated

Usage Note: The default card will be automatically used for subscriptions and future invoices unless specified otherwise.

## 8-

`DELETE /api/delete-card/:customerId/:paymentMethodId`
Remove a saved card from a customer.

When to use:

- User wants to remove an expired or old card
- Card was compromised and needs to be removed
- User is deleting their account and wants to remove payment methods

URL Parameters:

- customerId - The customer's Stripe ID
- paymentMethodId - The card ID to delete

Response: Confirms card has been detached from customer

Important: Cannot delete the default card if it's the only card. Set another card as default first.

# 💰 One-Time Payment Routes

## 9-

`POST /api/create-payment-intent`

Purpose: Create a payment intent for a single, one-time charge.

When to use:

- Processing a one-time product purchase
- Charging for a service or booking
- Accepting donations or tips
- Any payment that doesn't recur automatically

Request Body:

```
{
  "amount": 49.99,                    // Required: Amount to charge
  "currency": "usd",                  // Optional: Defaults to 'usd'
  "customerId": "cus_xxxxxxxxxxxxx",  // Optional: Associate with customer
  "description": "Product purchase",  // Optional: What the payment is for
  "paymentMethodId": "pm_xxxxxxxxxxxxx" // Optional: If provided, charges immediately
}
```

Response:

```
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",  // Send to mobile app for confirmation
  "paymentIntentId": "pi_xxxxxxxxxxxxx",
  "status": "requires_confirmation"
}
```

Two Usage Patterns:

**Pattern 1 - Collect card details on mobile:**

- Call this endpoint without paymentMethodId
- Get clientSecret
- Use Stripe SDK on mobile to collect card and confirm payment
- Payment completes on device

**Pattern 2 - Use saved card:**

- Call this endpoint with paymentMethodId of saved card
- Payment processes immediately without user interaction
- Check response status to confirm success

## 10-

`POST /api/confirm-payment-intent`

Purpose: Confirm a payment intent that was created but not yet confirmed.

When to use:

- If you created a payment intent without confirming it
- After user selects a saved card to use for payment
- To retry a failed payment after fixing payment method

Request Body:

```
{
  "paymentIntentId": "pi_xxxxxxxxxxxxx",
  "paymentMethodId": "pm_xxxxxxxxxxxxx"
}
```

Usage Note: Most apps can use create-payment-intent with paymentMethodId to confirm immediately, making this endpoint less commonly needed.

## 11-

`GET /api/payment-intent/:paymentIntentId`
Purpose: Check the status of a payment intent.

When to use:

- After confirming a payment to verify it succeeded
- When handling webhook events for async payment methods
- For debugging payment failures

URL Parameters: paymentIntentId - The payment intent ID

Response: Returns current status: succeeded, requires_payment_method, requires_confirmation, requires_action, canceled

# 🔄 Recurring Payment (Subscription) Routes

## 12-

`POST /api/create-product`

Purpose: Create a product and price for subscriptions. Products represent what you're selling, prices define how much and how often.

When to use:

- Setting up your subscription plans in Stripe
- Creating new pricing tiers
- Admin/setup endpoint, not called per user

Request Body:

```
{
  "name": "Premium Plan",              // Required: Display name
  "description": "Monthly premium",    // Optional: Detailed description
  "amount": 29.99,                     // Required: Price amount
  "currency": "usd",                   // Optional: Default 'usd'
  "interval": "month",                 // Required: 'day', 'week', 'month', 'year'
  "intervalCount": 1                   // Optional: Every X intervals (default 1)
}
```

Response

```
{
  "success": true,
  "productId": "prod_xxxxxxxxxxxxx",
  "priceId": "price_xxxxxxxxxxxxx"
}
```

Usage Example: Create your subscription plans once during app setup or via admin panel. Save the priceId for creating subscriptions.

Common Intervals:

- interval: "week" - Weekly billing
- interval: "month" - Monthly billing
- interval: "year" - Annual billing
- interval: "day" - Daily billing (uncommon)

Combine with intervalCount: 3 for quarterly billing

## -

## 13 -

`POST /api/create-recurring-payment`
Purpose: Create a subscription for a customer (weekly, monthly, yearly, or custom intervals).

When to use:

- User subscribes to a paid plan
- Upgrading from trial to paid
- Creating any recurring billing arrangement

Request Body:

```
{
  "customerId": "cus_xxxxxxxxxxxxx",     // Required: Who's subscribing
  "paymentMethodId": "pm_xxxxxxxxxxxxx", // Optional: Saved card to use
  "amount": 29.99,                       // Required: Price per interval
  "currency": "usd",                     // Optional: Default 'usd'
  "interval": "month",                   // Required: 'day', 'week', 'month', 'year'
  "intervalCount": 1,                    // Optional: Billing frequency
  "productName": "Monthly Premium",      // Optional: Display name
  "trialDays": 7,                        // Optional: Free trial period
  "numberOfPayments": 12                 // Optional: Limit total payments
}
```

Response:

```
{
  "success": true,
  "subscriptionId": "sub_xxxxxxxxxxxxx",
  "priceId": "price_xxxxxxxxxxxxx",
  "interval": "month",
  "intervalCount": 1,
  "amount": 29.99,
  "clientSecret": "pi_xxx_secret_xxx",  // For first payment confirmation
  "status": "incomplete",                // 'incomplete', 'active', 'past_due', 'canceled'
  "currentPeriodStart": 1699123456,     // Unix timestamp
  "currentPeriodEnd": 1701715456,       // When next billing occurs
  "trialEnd": 1699728256                // If trial was set
}
```

Subscription Status Meanings:

- incomplete - First payment not completed yet
- active - Subscription is active and paying
- past_due - Latest payment failed
- canceled - Subscription was canceled
- trialing - In free trial period

Usage Examples:

- Weekly Subscription:

```
{
  "customerId": "cus_xxx",
  "amount": 9.99,
  "interval": "week",
  "intervalCount": 1,
  "productName": "Weekly Plan"
}
```

Monthly Subscription:

```
{
  "customerId": "cus_xxx",
  "amount": 29.99,
  "interval": "month",
  "productName": "Monthly Plan"
}
```

Quarterly (every 3 months):

{
"customerId": "cus_xxx",
"amount": 89.99,
"interval": "month",
"intervalCount": 3,
"productName": "Quarterly Plan"
}
Yearly Subscription:

```
{
  "customerId": "cus_xxx",
  "amount": 299.99,
  "interval": "year",
  "productName": "Annual Plan"
}
```

## 14-

`POST /api/create-price-plans`
Purpose: Create multiple subscription plans at once for the same product.

When to use:

- Setting up multiple pricing tiers (weekly, monthly, yearly)
- Creating a complete product catalog
- Admin setup endpoint for initial configuration

Request Body:

```
{
  "productName": "Premium Membership",
  "plans": [
    {
      "name": "Weekly",
      "amount": 4.99,
      "interval": "week",
      "intervalCount": 1,
      "order": 1
    },
    {
      "name": "Monthly",
      "amount": 14.99,
      "interval": "month",
      "order": 2
    },
    {
      "name": "Yearly",
      "amount": 149.99,
      "interval": "year",
      "order": 3
    }
  ]
}
```

Response: Returns all created price IDs for each plan

Usage: Call once during app setup, save the returned price IDs for creating subscriptions later.

## 15-

`GET /api/customer-subscriptions/:customerId`

Get all subscriptions for a customer with full details.

When to use:

- Display user's active subscriptions in app
- Check subscription status before providing premium features
- Show billing history and upcoming charges
- Let user manage their subscriptions

URL Parameters: customerId - The customer's Stripe ID

Response:

```
{
  "success": true,
  "subscriptions": [
    {
      "id": "sub_xxxxxxxxxxxxx",
      "status": "active",
      "currentPeriodStart": 1699123456,
      "currentPeriodEnd": 1701715456,
      "cancelAtPeriodEnd": false,
      "items": [
        {
          "priceId": "price_xxxxxxxxxxxxx",
          "amount": 29.99,
          "currency": "usd",
          "interval": "month",
          "intervalCount": 1,
          "productName": "Monthly Premium"
        }
      ],
      "defaultPaymentMethod": {
        "brand": "visa",
        "last4": "4242"
      }
    }
  ]
}
```

Usage Flow:

- Call this when user opens subscription management screen
- Display active subscriptions and their status
- Show when next payment is due (currentPeriodEnd)
- Allow cancellation or plan changes based on status

## 16-

`POST /api/cancel-subscription`
Purpose: Cancel an active subscription either immediately or at period end.

When to use:

- User wants to stop recurring payments
- User downgrades to free plan
- Payment failures require subscription to be canceled
- Admin removes a user's subscription

Request Body:

```
{
  "subscriptionId": "sub_xxxxxxxxxxxxx",
  "cancelAtPeriodEnd": true   // true = end of current period, false = immediate
}
```

Response

```
{
  "success": true,
  "message": "Subscription will be cancelled at period end",
  "subscription": { ... }
}
```

Cancellation Types:

- At Period End (cancelAtPeriodEnd: true):
- User keeps access until current billing period ends
- No further charges after current period
- Preferred for customer retention
- Immediate (cancelAtPeriodEnd: false):
- Subscription ends right away
- User loses access immediately
- May provide partial refunds

## 17-

`POST /api/update-subscription`

Purpose: Update subscription details like plan, quantity, or cancellation settings.

When to use:

- User upgrades or downgrades their plan
- Changing quantity for per-seat pricing
- Reversing a pending cancellation

Request Body:

```
{
  "subscriptionId": "sub_xxxxxxxxxxxxx",
  "newPriceId": "price_yyyyyyyyyyyyy",  // New plan price ID
  "quantity": 2,                         // For per-seat subscriptions
  "cancelAtPeriodEnd": false             // Cancel pending cancellation
}
```

Usage Example: When user switches from monthly to yearly plan, provide the yearly priceId as newPriceId.

Proration: Stripe automatically handles prorated charges when changing plans.

## 18-

POST /api/change-subscription-interval
Purpose: Change the billing interval of an existing subscription.

When to use:

- User wants to switch from monthly to yearly billing
- Changing billing frequency without changing the product
- Special promotions or custom billing arrangements

Request Body:

```
{
  "subscriptionId": "sub_xxxxxxxxxxxxx",
  "newInterval": "year",          // 'week', 'month', 'year'
  "newIntervalCount": 1,
  "newAmount": 299.99,
  "currency": "usd"
}
```

Difference from update-subscription: This endpoint creates a new price with the specified interval rather than using an existing price ID.

# 💵 Refund Routes

## 19-

`POST /api/refund`
Purpose: Process a refund for a successful payment.

When to use:

- Customer requests refund
- Order was cancelled or couldn't be fulfilled
- Duplicate charge was made
- Fraudulent transaction detected

Request Body:

```
{
  "paymentIntentId": "pi_xxxxxxxxxxxxx",  // Required: Payment to refund
  "amount": 25.00,                         // Optional: Partial refund amount
  "reason": "requested_by_customer"        // Optional: 'duplicate', 'fraudulent', 'requested_by_customer'
}
```

Response

```
{
  "success": true,
  "refund": { ... }
}
```

Refund Types:

- Full refund: Omit amount field, refunds entire payment
- Partial refund: Specify amount to refund only part
- Reasons: Helps with reporting and fraud analysis

Important Notes:

- Refunds can only be processed for successful payments
- Time limit depends on payment method (usually 90-120 days)
- Stripe fees are not automatically refunded

# 📡 Webhook Routes

## 21-

`POST /webhook/stripe`

Purpose: Receive asynchronous events from Stripe for subscription and payment updates.

When to use:

- Always in production to handle background events
- To update user access when subscriptions change
- To send email receipts or notifications
- To sync subscription status with your app

Events Handled:

- customer.subscription.created - New subscription started
- customer.subscription.updated - Plan changed, renewed, or modified
- customer.subscription.deleted - Subscription canceled
- invoice.payment_succeeded - Payment was successful
- invoice.payment_failed - Payment failed (retry payment method)
- payment_intent.succeeded - One-time payment succeeded

Setup Required:

- Expose your local server using ngrok: ngrok http 3000
- In Stripe Dashboard, add webhook endpoint: https://your-domain.com/webhook/stripe
- Copy the webhook signing secret to your .env file
- Select which events to send

Why Webhooks Matter:

- No polling needed: Stripe pushes updates in real-time
- Handle failures: Detect failed payments and notify user
- Sync access: Update user's premium status when subscription changes
- Receipts: Send custom receipts when payment succeeds

# 🔄 Common Usage Flows

### Flow 1: New User Signup with Card Saving

- Create customer: POST /api/create-customer
- Save card: POST /api/save-card-setup → Get clientSecret
- Collect card on mobile (Stripe SDK)
- Attach card: POST /api/attach-payment-method
- Get saved cards: GET /api/saved-cards/:customerId

### Flow 2: One-Time Purchase with Saved Card

- Get saved cards: GET /api/saved-cards/:customerId
- Select card (user chooses which card to use)
- Create payment: POST /api/create-payment-intent with paymentMethodId
- Check status: Verify succeeded in response

### Flow 3: New Subscription (Weekly/Monthly/Yearly)

- Create customer (if new user)
- Save card (if not already saved)
- Create subscription: POST /api/create-recurring-payment with appropriate interval
- Confirm first payment using clientSecret in response
- Store subscription ID for future management

### Flow 4: Subscription Management

Get subscriptions: GET /api/customer-subscriptions/:customerId

- Display plans to user
- Update plan: POST /api/update-subscription with newPriceId
- Cancel: POST /api/cancel-subscription

### Flow 5: Card Management

- View cards: GET /api/saved-cards/:customerId
- Set default: POST /api/set-default-card
- Add new card: Repeat Flow 1 steps 2-4
- Delete card: DELETE /api/delete-card/:customerId/:pmId

# Testing: Use Stripe's test card numbers:

- 4242 4242 4242 4242 - Success
- 4000 0000 0000 9995 - Insufficient funds
- 4000 0000 0000 9987 - Lost card

# Recurring Payment Flow: 3-Day Trial → $5.99/Week

## Step 1: Create Customer

Endpoint: POST /api/create-customer
Purpose: Create a customer in Stripe to associate the subscription with.

Store customerId from response in your app for future requests

## Step 2: Save Payment Method (Card)

**Step 2a: Create Setup Intent**
Endpoint: POST /api/save-card-setup

## Step 2b: Collect Card on Mobile

- Use Stripe SDK on your mobile app with the clientSecret
- User enters card details
- Stripe returns a paymentMethodId (e.g., pm_abc456)

## Step 2c: Attach Card to Customer

Endpoint: POST /api/attach-payment-method

```
{
  "customerId": "cus_xyz123",
  "paymentMethodId": "pm_abc456",
  "setAsDefault": true
}
```

Stripe will NOT charge the card during trial period. The card is only saved for future billing.

## Step 3: Create Subscription with 3-Day Trial

Endpoint: POST /api/create-recurring-payment

Purpose: Create the weekly subscription with 3-day free trial.

Request

```
{
  "customerId": "cus_xyz123",
  "paymentMethodId": "pm_abc456",
  "amount": 5.99,
  "currency": "usd",
  "interval": "week",
  "intervalCount": 1,
  "productName": "Weekly Premium Plan",
  "trialDays": 3
}
```

Response

```
{
  "success": true,
  "subscriptionId": "sub_weekly123",
  "status": "trialing",
  "amount": 5.99,
  "interval": "week",
  "currentPeriodStart": 1700000000,
  "currentPeriodEnd": 1700604800,
  "trialEnd": 1700259200
}
```

Key Response Fields:

- status: "trialing" - Subscription is in trial mode
- trialEnd - Unix timestamp when trial ends (3 days from creation)
- currentPeriodEnd - When first billing period ends (trial end date)

## Step 4: Handle Trial Period

During Trial (Days 1-3):

- User has full access to premium features
- No charges have been made
- User can cancel anytime without payment

**Check Subscription Status During Trial**
Endpoint: GET /api/customer-subscriptions/:customerId

Request: GET /api/customer-subscriptions/cus_xyz123

Response

```
{
  "success": true,
  "subscriptions": [
    {
      "id": "sub_weekly123",
      "status": "trialing",
      "trialEnd": 1700259200,
      "currentPeriodEnd": 1700259200,
      "cancelAtPeriodEnd": false
    }
  ]
}
```

- Show user how many trial days remain
- Display "Your trial ends in X days" message
- Determine if user should have premium access

# Step 5: Automatic Conversion to Paid

Day 3 (End of Trial):
Stripe automatically:

- Ends the trial period
- Charges the saved card $5.99
- Converts subscription to "active" status

What happens automatically (no API call needed):

- Stripe creates an invoice
- Stripe attempts to charge the saved card
- If successful, subscription becomes status: "active"
- If fails, subscription becomes status: "past_due"

## Step 6: Monitor Trial Conversion (Webhook Recommended)

Endpoint: POST /webhook/stripe

Set up a webhook to detect when trial ends and payment succeeds/fails.

- invoice.payment_succeeded
- invoice.payment_failed

```
{
  "type": "invoice.payment_succeeded",
  "data": {
    "object": {
      "subscription": "sub_weekly123",
      "customer": "cus_xyz123",
      "amount_paid": 599,
      "status": "paid"
    }
  }
}
```

## Check Payment History

Endpoint: GET /api/customer-subscriptions/:customerId

## complete flow

```
Day 0 (Now): User signs up
├── Create customer
├── Save card (no charge)
├── Create subscription with trialDays=3
└── Status: "trialing" ✅ Access granted

Day 1-2: Trial continues
├── Status remains "trialing"
├── No charges
└── User can cancel anytime

Day 3 (Trial ends):
├── Stripe automatically:
│   ├── Ends trial
│   ├── Charges card $5.99
│   └── Subscription becomes "active"
├── Webhook: invoice.payment_succeeded
└── ✅ Access continues

Day 10 (First renewal):
├── Stripe charges $5.99 again
├── Subscription renews for another week
└── Status remains "active"

Day 17 (Second renewal):
├── Another $5.99 charge
└── Pattern repeats weekly
```

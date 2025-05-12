const mongoose = require('mongoose');

// Define order item schema (similar to cart item, but immutable)
const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0.01, 'Price must be greater than 0']
  },
  // Store product details to keep order history intact even if product is deleted
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String
  },
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  },
  retailerName: {
    type: String,
    required: true
  }
});

// Define status history schema to track status changes
const StatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String
  }
});

// Define payment schema
const PaymentSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'cash_on_delivery', 'wallet']
  },
  transactionId: {
    type: String
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAt: {
    type: Date
  }
});

// Define delivery schema
const DeliverySchema = new mongoose.Schema({
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true }
  },
  contactPhone: {
    type: String,
    required: true
  },
  instructions: {
    type: String
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  trackingNumber: {
    type: String
  }
});

// Define the main Order schema
const OrderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Order must belong to a customer']
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [OrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  statusHistory: [StatusHistorySchema],
  payment: PaymentSchema,
  delivery: DeliverySchema,
  couponCode: {
    type: String
  },
  notes: {
    type: String
  },
  cancelReason: {
    type: String
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Generate unique order number before saving
OrderSchema.pre('save', async function(next) {
  // Only generate order number for new orders
  if (this.isNew) {
    // Generate order number based on date and a random number
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    this.orderNumber = `NM-${year}${month}${day}-${random}`;
    
    // Add initial status to history
    this.statusHistory.push({
      status: this.status,
      timestamp: Date.now(),
      note: 'Order created'
    });
  }
  next();
});

// Virtual for total items count
OrderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to update order status
OrderSchema.methods.updateStatus = function(status, note = '') {
  this.status = status;
  this.statusHistory.push({
    status,
    timestamp: Date.now(),
    note
  });
  
  // If order is delivered, set the actual delivery date
  if (status === 'delivered' && this.delivery) {
    this.delivery.actualDeliveryDate = new Date();
  }
  
  // If order is confirmed, set expected delivery date (3 days from now by default)
  if (status === 'confirmed' && this.delivery && !this.delivery.expectedDeliveryDate) {
    this.delivery.expectedDeliveryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  }
  
  return this.save();
};

// Method to cancel order
OrderSchema.methods.cancelOrder = function(reason) {
  if (this.status === 'delivered') {
    throw new Error('Cannot cancel an order that has been delivered');
  }
  
  this.status = 'cancelled';
  this.cancelReason = reason;
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: Date.now(),
    note: reason
  });
  
  return this.save();
};

// Method to update payment status
OrderSchema.methods.updatePayment = function(status, transactionId = null) {
  if (!this.payment) {
    throw new Error('Payment information not found');
  }
  
  this.payment.status = status;
  
  if (transactionId) {
    this.payment.transactionId = transactionId;
  }
  
  if (status === 'completed') {
    this.payment.paidAt = new Date();
  }
  
  return this.save();
};

// Static method to create order from cart
OrderSchema.statics.createFromCart = async function(cartId, paymentDetails, deliveryDetails) {
  const Cart = mongoose.model('Cart');
  const cart = await Cart.findById(cartId).populate({
    path: 'items.product',
    populate: {
      path: 'retailer',
      select: 'name storeName'
    }
  });
  
  if (!cart) {
    throw new Error('Cart not found');
  }
  
  if (cart.items.length === 0) {
    throw new Error('Cannot create order with empty cart');
  }
  
  // Verify all items are available and in stock
  const availability = await cart.verifyAvailability();
  if (!availability.isValid) {
    throw new Error('Some items are unavailable or out of stock');
  }
  
  // Create order items from cart items
  const items = cart.items.map(item => ({
    product: item.product._id,
    quantity: item.quantity,
    price: item.price,
    productName: item.productName,
    productImage: item.productImage,
    retailer: item.product.retailer._id,
    retailerName: item.product.retailer.storeName
  }));
  
  // Calculate totals
  const subtotal = cart.subtotal;
  const tax = parseFloat((subtotal * 0.1).toFixed(2)); // Example: 10% tax
  const deliveryFee = deliveryDetails.fee || 0;
  const total = subtotal + tax + deliveryFee - cart.discount;
  
  // Create the order
  const order = await this.create({
    customer: cart.customer,
    items,
    subtotal,
    discount: cart.discount,
    tax,
    deliveryFee,
    total,
    couponCode: cart.couponCode,
    payment: {
      method: paymentDetails.method,
      amount: total,
      status: paymentDetails.method === 'cash_on_delivery' ? 'pending' : 'completed',
      transactionId: paymentDetails.transactionId,
      paidAt: paymentDetails.method === 'cash_on_delivery' ? null : new Date()
    },
    delivery: {
      address: deliveryDetails.address,
      contactPhone: deliveryDetails.contactPhone,
      instructions: deliveryDetails.instructions,
      expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Default: 2 days from now
    }
  });
  
  // Update product stock
  const Product = mongoose.model('Product');
  for (const item of cart.items) {
    await Product.updateStock(item.product, item.quantity);
  }
  
  // Clear the cart after successful order creation
  await cart.clearCart();
  
  return order;
};

// Add index for faster querying
OrderSchema.index({ customer: 1, createdAt: -1 });
// Removed duplicate orderNumber index (already indexed by unique: true)
OrderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', OrderSchema);


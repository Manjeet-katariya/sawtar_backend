// models/product.model.js
const { Schema, model } = require('mongoose');

/**
 * Counter Schema for auto-increment product_code
 */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = model('Counter', counterSchema);

/**
 * Document Schema
 */
const documentSchema = new Schema({
  type: { type: String, trim: true },
  path: { type: String, trim: true },
  verified: { type: Boolean, default: false },
  reason: { type: String, trim: true },
  suggestion: { type: String, trim: true },
  uploaded_at: { type: Date, default: Date.now }
});

/**
 * Documents group schema
 */
const documentsSchema = new Schema({
  product_invoice: { type: documentSchema },
  product_certificate: { type: documentSchema },
  quality_report: { type: documentSchema }
}, { _id: false });

/**
 * Image Schema
 */
const imageSchema = new Schema({
  url: { type: String, trim: true, required: true },
  position: { type: Number, required: true, min: 1, max: 5 },
  alt_text: { type: String, trim: true },
  is_primary: { type: Boolean, default: false },
  uploaded_at: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  reason: { type: String, trim: true },
  suggestion: { type: String, trim: true }
});

/**
 * Color Variant Schema
 */
const colorVariantSchema = new Schema({
  color_name: { type: String, trim: true, required: true },
  color_code: { type: String, trim: true },
  images: {
    type: [imageSchema],
    validate: [
      (val) => val.length <= 5,
      '{PATH} exceeds the limit of 5 images per color'
    ]
  }
}, { _id: false });

/**
 * 3D Model Schema
 */
const threeDModelSchema = new Schema({
  url: { type: String, trim: true, required: true },
  format: { type: String, enum: ['glb', 'gltf', 'obj', 'fbx'], required: true },
  alt_text: { type: String, trim: true },
  uploaded_at: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  reason: { type: String, trim: true },
  suggestion: { type: String, trim: true }
});

/**
 * Product Schema
 */
const productSchema = new Schema({
  vendor: { type: Schema.Types.ObjectId, ref: 'VendorB2C', required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
  material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
  attributes: [{ type: Schema.Types.ObjectId, ref: 'Attribute' }],
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  short_description: { type: String, trim: true, maxlength: 200 },
  product_code: { type: String, trim: true, unique: true },
  care_maintenance: { type: String, trim: true },
  warranty: { type: String, trim: true },
  returns: { type: String, trim: true },
  quality_promise: { type: String, trim: true },

  pricing: {
    mrp: { type: Number, required: true, min: 0, default: 0 },
    base_price: { type: Number, required: true, min: 0, default: 0 },
    cost_price: { type: Number, required: true, min: 0, default: 0 },
    sale_price: { type: Number, min: 0, default: 0 },
    margin: { type: Number, min: 0, default: 0 },
    currency: { type: Schema.Types.ObjectId, ref: 'Currency', required: true },

    discount: {
      type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
      value: { type: Number, min: 0, default: 0 },
      approved: { type: Boolean, default: false },
      approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
      valid_till: { type: Date }
    },

    tax: {
      tax_id: { type: Schema.Types.ObjectId, ref: 'Tax' },
      rate: { type: Number, min: 0, max: 100, default: 0 }
    },

    final_price: { type: Number, min: 0, default: 0 }
  },

  documents: { type: documentsSchema, default: {} },
  color_variants: [colorVariantSchema],
  three_d_model: { type: threeDModelSchema },

  shipping: {
    weight: { type: String, trim: true },
    dimensions: {
      length: { type: String, trim: true },
      width: { type: String, trim: true },
      height: { type: String, trim: true }
    },
    free_shipping: { type: Boolean, default: false }
  },

  status: {
    type: String,
    enum: ['draft', 'pending_verification', 'active', 'rejected', 'inactive', 'archived'],
    default: 'draft'
  },
  verification_status: {
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'draft'], default: 'pending' },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    verified_at: { type: Date },
    rejection_reason: { type: String, trim: true },
    suggestion: { type: String, trim: true }
  },

  seo: {
    meta_title: { type: String, trim: true, maxlength: 60 },
    meta_description: { type: String, trim: true, maxlength: 160 },
    keywords: [{ type: String, trim: true }]
  }
}, {
  timestamps: true
});

/**
 * Pre-save hook to auto-generate product_code using counter
 */
productSchema.pre('save', async function (next) {
  if (!this.product_code) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'product_code' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.product_code = `PRD${String(counter.seq).padStart(3, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

/**
 * Pre-save hook to calculate final_price and margin safely
 */
productSchema.pre('save', function (next) {
  const pricing = this.pricing;
  if (!pricing) return next();

  pricing.base_price = pricing.base_price || 0;
  pricing.cost_price = pricing.cost_price || 0;
  pricing.sale_price = pricing.sale_price || 0;
  pricing.margin = pricing.margin || 0;
  pricing.discount = pricing.discount || {};
  pricing.discount.value = pricing.discount.value || 0;

  pricing.margin = Math.max(pricing.base_price - pricing.cost_price, 0);

  let price = pricing.sale_price > 0 ? pricing.sale_price : pricing.base_price;

  const now = new Date();
  const discountValid = pricing.discount.approved &&
                        pricing.discount.value > 0 &&
                        (!pricing.discount.valid_till || pricing.discount.valid_till > now);

  if (discountValid) {
    if (pricing.discount.type === 'percentage') {
      price = price * (1 - pricing.discount.value / 100);
    } else {
      price = price - pricing.discount.value;
    }
  }

  pricing.final_price = Math.max(price, 0);

  next();
});

// Indexes
productSchema.index({ name: 'text', short_description: 'text', description: 'text' });
productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ 'verification_status.status': 1 });

const ProductB2C = model('ProductB2C', productSchema);
module.exports = ProductB2C;

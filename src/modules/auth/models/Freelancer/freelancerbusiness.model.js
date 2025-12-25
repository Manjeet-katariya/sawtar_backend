// modules/businesses/models/business.model.js
const mongoose = require('mongoose');

const location_schema = new mongoose.Schema({
  address: { type: String, trim: true },
  landmark: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
  pincode: { type: String, trim: true },
  geo_location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [lng, lat]
  }
});

const registration_schema = new mongoose.Schema({
  pan_number: { type: String, trim: true },
  gstin: { type: String, trim: true },
  business_license: { type: String, trim: true },
  fssai_number: { type: String, trim: true },
  msme_number: { type: String, trim: true }
});

const bank_details_schema = new mongoose.Schema({
  account_holder_name: { type: String, trim: true },
  account_number: { type: String, trim: true },
  ifsc_code: { type: String, trim: true },
  upi_id: { type: String, trim: true }
});

const contact_schema = new mongoose.Schema({
  name: { type: String, trim: true },
  designation: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  is_primary: { type: Boolean, default: false }
});

const service_schema = new mongoose.Schema({
  name: { type: String, trim: true },
  description: { type: String, trim: true },
  price_range: { type: String, trim: true },
  images: [{ type: String }]
});

const product_schema = new mongoose.Schema({
  name: { type: String, trim: true },
  description: { type: String, trim: true },
  price: { type: Number },
  images: [{ type: String }],
  in_stock: { type: Boolean, default: true }
});

const operational_hours_schema = new mongoose.Schema({
  monday: { type: String, trim: true },
  tuesday: { type: String, trim: true },
  wednesday: { type: String, trim: true },
  thursday: { type: String, trim: true },
  friday: { type: String, trim: true },
  saturday: { type: String, trim: true },
  sunday: { type: String, trim: true }
});

const performance_schema = new mongoose.Schema({
  average_rating: { type: Number, min: 0, max: 5, default: 0 },
  total_reviews: { type: Number, default: 0 },
  total_views: { type: Number, default: 0 },
  total_leads: { type: Number, default: 0 }
});

const business_schema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },

  // Updated Name & Mobile for Owner
  name: {
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name:  { type: String, required: true, trim: true, maxlength: 50 }
  },
        role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  
  mobile: {
    country_code: { type: String, required: true, trim: true, default: '+91' },
    number: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: v => /^\d{8,15}$/.test(v),
        message: 'Mobile number must be 8–15 digits only'
      }
    }
  },
  is_mobile_verified: { type: Boolean, default: false },

  // Business Core
  business_name: { type: String, required: true, trim: true },
  tagline: { type: String, trim: true },
  description: { type: String, trim: true },
  business_type: {
    type: String,
    enum: ['Individual', 'Private Limited', 'Partnership', 'LLP', 'Public Limited', 'Others']
  },
  year_established: { type: String, trim: true },
  employee_count: { type: Number, min: 0 },

  // Services & Products
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  offered_services: [service_schema],
  products: [product_schema],

  // Media
  logo: { type: String, trim: true },
  gallery: [{ type: String }],
  videos: [{ type: String }],

  // Location
  location: location_schema,

  // Legal & Bank
  registration: registration_schema,
  bank_details: bank_details_schema,

  // Contacts
  contacts: [contact_schema],

  // Operations
  operational_hours: operational_hours_schema,
  return_policy: { type: String, trim: true },

  // Performance
  performance: performance_schema,

  // Online Presence
  website: { type: String, trim: true },
  social_links: {
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    youtube: { type: String, trim: true }
  },

  // Status
  is_active: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  approved_at: { type: Date },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
business_schema.index({ 'location.geo_location': '2dsphere' });
business_schema.index({ business_name: 'text', 'offered_services.name': 'text' });
business_schema.index({ services: 1 });
business_schema.index({ 'location.city': 1 });
business_schema.index({ status: 1 });
business_schema.index({ is_active: 1 });
business_schema.index({ 'mobile.number': 1 });

const Business = mongoose.model('Business', business_schema);

module.exports = { Business };
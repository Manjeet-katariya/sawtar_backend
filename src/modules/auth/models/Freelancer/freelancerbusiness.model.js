// modules/businesses/models/business.model.js
const mongoose = require('mongoose');

/* =========================
   LOCATION SCHEMA
========================= */
const locationSchema = new mongoose.Schema({
  address: { type: String, trim: true },
  landmark: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
  pincode: { type: String, trim: true },
  geo_location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: v => !v || v.length === 2,
        message: 'Geo location must be [longitude, latitude]'
      }
    }
  }
}, { _id: false });

/* =========================
   SOCIAL LINKS
========================= */
const socialLinksSchema = new mongoose.Schema({
  website: { type: String, trim: true },
  facebook: { type: String, trim: true },
  instagram: { type: String, trim: true },
  twitter: { type: String, trim: true },
  linkedin: { type: String, trim: true },
  youtube: { type: String, trim: true }
}, { _id: false });

/* =========================
   DOCUMENTS (ADMIN VERIFICATION)
========================= */
const documentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'identityProof',
      'addressProof',
      'businessLicense',
      'gstCertificate',
      'other'
    ],
    required: true
  },
  path: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verified_at: Date,
  verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, trim: true },
  suggestion: { type: String, trim: true },
  uploaded_at: { type: Date, default: Date.now }
});

/* =========================
   STATUS HISTORY
========================= */
const statusInfoSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['registered', 'under_review', 'approved', 'rejected', 'suspended'],
    required: true
  },
  reason: { type: String, trim: true },
  suggestion: { type: String, trim: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updated_at: { type: Date, default: Date.now }
}, { _id: false });

/* =========================
   SERVICES (FOR SERVICE BUSINESSES)
========================= */
const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price_range: { type: String, trim: true },
  images: [{ type: String }]
}, { _id: false });

/* =========================
   PROJECTS / PORTFOLIO
========================= */
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  tools_used: [{ type: String, trim: true }],
  cover_image: String,
  images: [{ type: String }],
  videos: [{ type: String }],
  published_at: { type: Date, default: Date.now }
}, { _id: false });

/* =========================
   OPERATIONAL HOURS
========================= */
const operationalHoursSchema = new mongoose.Schema({
  monday: String,
  tuesday: String,
  wednesday: String,
  thursday: String,
  friday: String,
  saturday: String,
  sunday: String,
  note: String
}, { _id: false });

/* =========================
   PERFORMANCE METRICS
========================= */
const performanceSchema = new mongoose.Schema({
  average_rating: { type: Number, min: 0, max: 5, default: 0 },
  total_reviews: { type: Number, default: 0 },
  total_views: { type: Number, default: 0 },
  total_leads: { type: Number, default: 0 },
  total_appreciations: { type: Number, default: 0 }
}, { _id: false });

/* =========================
   CONTACTS
========================= */
const contactSchema = new mongoose.Schema({
  name: String,
  designation: String,
  email: { type: String, lowercase: true, trim: true },
  mobile: String,
  whatsapp: String,
  is_primary: { type: Boolean, default: false }
}, { _id: false });

/* =========================
   BUSINESS MAIN SCHEMA
========================= */
const businessSchema = new mongoose.Schema({
  /* AUTH (OWNER) */
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false // IMPORTANT
  },

  owner_name: {
    first_name: { type: String, required: true },
    last_name: { type: String, required: true }
  },

  mobile: {
    country_code: { type: String, default: '+91' },
    number: { type: String, required: true }
  },
  is_mobile_verified: { type: Boolean, default: false },

  /* BUSINESS INFO */
  business_name: { type: String, required: true, trim: true },
  tagline: { type: String, trim: true },
  description: { type: String, trim: true },

  categories: [{ type: String, required: true }], // Salon, Shop, Restaurant

  year_established: { type: Number },
  employee_count: { type: Number, min: 0 },

  /* SERVICES & PORTFOLIO */
  services: [serviceSchema],
  projects: [projectSchema],

  /* MEDIA */
  logo: String,
  banner_image: String,
  gallery: [{ type: String }],
  videos: [{ type: String }],

  /* LOCATION */
  location: locationSchema,

  /* CONTACT */
  contacts: [contactSchema],

  /* OPERATIONS */
  operational_hours: operationalHoursSchema,
  payment_modes: [{ type: String }],

  /* SOCIAL */
  social_links: socialLinksSchema,

  /* DOCUMENTS */
  documents: [documentSchema],

  /* PERFORMANCE */
  performance: performanceSchema,

  /* STATUS & APPROVAL */
  onboarding_status: {
    type: String,
    enum: [
      'registered',
      'profile_incomplete',
      'profile_submitted',
      'under_review',
      'approved',
      'rejected',
      'suspended'
    ],
    default: 'registered'
  },

  status_info: [statusInfoSchema],

  is_active: { type: Boolean, default: false },
  approved_at: Date,
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, { timestamps: true });

/* =========================
   INDEXES (SEARCH & SPEED)
========================= */
businessSchema.index({ 'location.geo_location': '2dsphere' });
businessSchema.index({
  business_name: 'text',
  tagline: 'text',
  description: 'text',
  categories: 'text',
  'services.name': 'text'
});
businessSchema.index({ categories: 1 });
businessSchema.index({ 'location.city': 1, 'location.state': 1 });
businessSchema.index({ onboarding_status: 1 });
businessSchema.index({ is_active: 1 });
businessSchema.index(
  { 'mobile.country_code': 1, 'mobile.number': 1 },
  { unique: true }
);
 
/* =========================
   EXPORT
========================= */
module.exports = mongoose.model('Business', businessSchema);

// models/freelancer.model.js (corrected version)

const mongoose = require('mongoose');

const location_schema = new mongoose.Schema({
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
  pincode: { type: String, trim: true }
}, { _id: false });

const document_schema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['resume', 'portfolio', 'identityProof', 'addressProof', 'certificate'],
    required: true
  },
  path: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verified_at: Date,
  verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  suggestion: String,
  uploaded_at: { type: Date, default: Date.now }
}, { _id: true });

const service_schema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  description: { type: String, trim: true },
  price_range: { type: String, trim: true },
  unit: { type: String, trim: true },
  images: [{ type: String }],
  is_active: { type: Boolean, default: true }
});

const social_links_schema = new mongoose.Schema({
  linkedin: {
    type: String,
    trim: true,
  },
  youtube: {
    type: String,
    trim: true,
  },
  instagram: {
    type: String,
    trim: true,
  },
  facebook: {
    type: String,
    trim: true,
  },
  twitter: {
    type: String,
    trim: true,
  },
  website: {
    type: String,
    trim: true
  }
}, { _id: false });

const professional_schema = new mongoose.Schema({
  experience_years: { type: Number, min: 0 },
  bio: { type: String, trim: true, maxlength: 1000 },
  skills: [{ type: String, trim: true }],
  availability: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Project-based'],
    default: 'Full-time'
  }
}, { _id: false });

const contact_schema = new mongoose.Schema({
  name: String,
  designation: String,
  email: String,
  mobile: String,
  whatsapp: String
}, { _id: false });

const performance_schema = new mongoose.Schema({
  average_rating: { type: Number, min: 0, max: 5, default: 0 },
  total_reviews: { type: Number, default: 0 },
  completed_jobs: { type: Number, default: 0 }
}, { _id: false });

const payment_schema = new mongoose.Schema({
  preferred_method: { type: String, trim: true },
  vat_number: { type: String, trim: true },
  preferred_currency: { type: mongoose.Schema.Types.ObjectId, ref: 'Currency' }
}, { _id: false });

const status_info_schema = new mongoose.Schema({
  status: { type: Number, enum: [0, 1, 2], default: 0 }, // 0=Pending, 1=Approved, 2=Rejected
  approved_at: Date,
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejected_at: Date,
  rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejection_reason: String
}, { _id: false });

const meta_schema = new mongoose.Schema({
  agreed_to_terms: { type: Boolean, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { _id: false });

const freelancer_schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },

  name: {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true }
  },

  mobile: {
    country_code: { type: String, default: '+91', trim: true, match: [/^\+\d{1,4}$/, 'Invalid country code'] },
    number: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: v => /^\d{8,15}$/.test(v),
        message: 'Mobile number must be 8–15 digits'
      }
    }
  },

  is_mobile_verified: { type: Boolean, default: false },
  profile_image: String,
social_links: social_links_schema,
  professional: { type: professional_schema, required: true },
  languages: [{ type: String, trim: true }],
  location: location_schema,
  services_offered: [service_schema],
  payment: payment_schema,
  primary_contact: contact_schema,
  support_contact: contact_schema,
  gallery: [{ type: String }],
  documents: [document_schema],
  performance: performance_schema,

  onboarding_status: {
    type: String,
    enum: ['registered', 'profile_incomplete', 'profile_submitted', 'under_review', 'approved', 'rejected', 'suspended'],
    default: 'registered'
  },

  status_info: status_info_schema,
  meta: { type: meta_schema, required: true },

  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },

  isActive: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

freelancer_schema.virtual('full_name').get(function () {
  return `${this.name.first_name} ${this.name.last_name}`.trim();
});

freelancer_schema.index({ email: 1 }, { unique: true });
freelancer_schema.index({ 'mobile.country_code': 1, 'mobile.number': 1 }, { unique: true, sparse: true });
freelancer_schema.index({ 'location.city': 1 });
freelancer_schema.index({ onboarding_status: 1 });
freelancer_schema.index({ 'services_offered.service': 1 });
freelancer_schema.index({ is_deleted: 1 });

freelancer_schema.pre('save', function (next) {
  this.meta.updated_at = new Date();
  next();
});

['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateMany'].forEach(method => {
  freelancer_schema.pre(method, function () {
    this.where({ is_deleted: false });
  });
});

module.exports = mongoose.model('Freelancer', freelancer_schema);
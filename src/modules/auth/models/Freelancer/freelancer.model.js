  const mongoose = require('mongoose');

  const service_schema = new mongoose.Schema({
    title: { type: String, required: [true, 'Service title is required'], trim: true },
    priceRange: { type: String, trim: true }
  });

  const location_schema = new mongoose.Schema({
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pincode: { type: String, trim: true }
  });

  const contact_schema = new mongoose.Schema({
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, trim: true },
    whatsapp: { type: String, trim: true }
  });

  const contacts_schema = new mongoose.Schema({
    primary_contact: { type: contact_schema },
    support_contact: { type: contact_schema }
  });

  const document_schema = new mongoose.Schema({
    type: { type: String, trim: true }, // e.g., Resume, Portfolio, Certificate
    path: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    reason: { type: String, trim: true }, // why rejected
    suggestion: { type: String, trim: true }, // what to do next
    uploaded_at: { type: Date, default: Date.now }
  });

  const documents_schema = new mongoose.Schema({
    resume: { type: document_schema },
    portfolio: { type: document_schema },
    certificates: [{ type: document_schema }],
    identity_proof: { type: document_schema },
    address_proof: { type: document_schema }
  });

  const review_schema = new mongoose.Schema({
    reviewId: { type: String, required: true, trim: true },
    user: { type: String, trim: true },
    rating: { type: Number, min: 0, max: 5 },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  });

  const performance_schema = new mongoose.Schema({
    ratings: { type: Number, min: 0, max: 5 },
    reviewsCount: { type: Number, min: 0 }
  });

  const common_schema = new mongoose.Schema({
    gallery: [{ type: String, trim: true }], // Paths to uploaded images
    reviews: [{ type: review_schema }],
    socialLinks: {
      linkedin: { type: String, trim: true },
      instagram: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      youtube: { type: String, trim: true }
    }
  });

  const status_info_schema = new mongoose.Schema({
    status: { type: Number, default: 0 }, // 0 = Pending, 1 = Approved, 2 = Rejected
    approved_at: { type: Date },
    approved_by: { type: String, trim: true }
  });

  const change_history_schema = new mongoose.Schema({
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_at: { type: Date, default: Date.now },
    changes: [{ type: String, trim: true }]
  });

  const meta_schema = new mongoose.Schema({
    agreed_to_terms: { type: Boolean, default: false },
    portal_access: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    change_history: [{ type: change_history_schema }]
  });

  const freelancer_schema = new mongoose.Schema({
    email: { type: String, unique: true, required: [true, 'Email is required'], lowercase: true, trim: true },
    password: { type: String, required: [true, 'Password is required'] },
    full_name: { type: String, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    mobile: { type: String, trim: true },
    is_mobile_verified: { type: Boolean, default: false },
    servicesOffered: [{ type: service_schema }],
    availability: { type: String, trim: true }, // e.g., Part-time, Full-time
    location: { type: location_schema },
    languages: [{ type: String, trim: true }],
    contacts: { type: contacts_schema },
    documents: { type: documents_schema },
    performance: { type: performance_schema },
    common: { type: common_schema },
    status_info: { type: status_info_schema },
    meta: { type: meta_schema, required: true }
  });

  // Add indexes for performance
  freelancer_schema.index({ mobile: 1 });
  freelancer_schema.index({ 'status_info.status': 1 });

  module.exports = mongoose.model('Freelancer', freelancer_schema);
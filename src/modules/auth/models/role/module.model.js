// modules/auth/models/role/module.model.js
const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300
  },
  icon: {
    type: String,
    trim: true,
    default: 'fas fa-folder' // e.g., 'fas fa-users' for Users module
  },
  route: {
    type: String,
    unique: true,
    trim: true,
    required: true // e.g., '/products' or '/employee/leads'
  },
  subModules: [
    {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
      },
      name: { type: String, required: true, trim: true },  // e.g., 'New Lead'
      route: { type: String, required: true, trim: true }, // e.g., '/employee/leads/new'
      icon: { type: String, trim: true, default: 'fas fa-circle' },
      isActive: { type: Boolean, default: true },
      position: { type: Number, default: 0 },
      dashboardView: { type: Boolean, default: false } // 👈 new field for subModules too
    }
  ],
  isActive: {
    type: Boolean,
    default: true
  },
  position: {
    type: Number,
    default: 0
  },
  dashboardView: {
    type: Boolean,
    default: false // 👈 new field for main module
  }
}, { timestamps: true });

ModuleSchema.pre('save', function(next) {
  if (this.isModified('name') && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

const Module = mongoose.model("Module", ModuleSchema);

module.exports = { Module };

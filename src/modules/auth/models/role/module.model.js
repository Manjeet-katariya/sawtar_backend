// models/role/module.model.js
const mongoose = require('mongoose');

const SubModuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  route: { type: String, required: true, trim: true },
  icon: { type: String, trim: true, default: 'fas fa-circle' },
  isActive: { type: Boolean, default: true },
  position: { type: Number, default: 0 },
  dashboardView: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { _id: true });

const ModuleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  slug: { type: String, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 300 },
  icon: { type: String, trim: true, default: 'fas fa-folder' },
  route: { type: String, unique: true, trim: true, required: true },
  subModules: [SubModuleSchema],
  isActive: { type: Boolean, default: true },
  position: { type: Number, default: 0 },
  dashboardView: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { timestamps: true });

// Auto slug
ModuleSchema.pre('save', function (next) {
  if (this.isModified('name') && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

const Module = mongoose.model('Module', ModuleSchema);
module.exports = { Module };
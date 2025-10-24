const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new Schema({
  street: { type: String, trim: true, required: true },
  city: { type: String, trim: true, required: true },
  state: { type: String, trim: true, required: true },
  country: { type: String, trim: true, required: true },
  postal_code: { type: String, trim: true, required: true },
  is_default: { type: Boolean, default: false },
}, { _id: true });

const customerSchema = new Schema({
  email: { type: String, required: true, trim: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true },
  date_of_birth: { type: Date },
  phone: { type: String, trim: true },
  addresses: [addressSchema],
  primary_address: { type: Schema.Types.ObjectId, ref: 'Customer.addresses' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  profile_image: { type: String, trim: true },
  meta: {
    agreed_to_terms: { type: Boolean, default: false },
    change_history: [{
      updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      updated_at: { type: Date, default: Date.now },
      changes: [{ type: String }],
    }],
    updated_at: { type: Date, default: Date.now },
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Hash password before saving
customerSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password for login
customerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Index for efficient querying

const Customer = model('Customer', customerSchema);

module.exports = Customer;
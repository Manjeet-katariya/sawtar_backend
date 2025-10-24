const { Schema, model } = require('mongoose');

const brandSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  logo: { type: String, trim: true },
  website: { type: String, trim: true },
  country: { type: String, trim: true },
  created_at: { type: Date, default: Date.now }
});


module.exports = model('Brand', brandSchema);
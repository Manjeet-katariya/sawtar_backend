const { Schema, model } = require('mongoose');

const materialSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  properties: [{ type: String, trim: true }],
  created_at: { type: Date, default: Date.now }
});


module.exports = model('Material', materialSchema);
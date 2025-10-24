const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  },
  canAdd: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  canEdit: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  canView: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  canDelete: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  canViewAll: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null // optional: who assigned this permission
  },
  isActive: {
    type: Boolean,
    default: true // Keep isActive as Boolean since it wasn't requested to change
  }
}, { timestamps: true });

const Permission = mongoose.model("Permission", PermissionSchema);

module.exports = { Permission };
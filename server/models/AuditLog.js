const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
  },
  adminName: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      "user_created",
      "user_updated",
      "user_deleted",
      "user_deactivated",
      "user_activated",
      "course_approved",
      "course_rejected",
      "bulk_user_action",
    ],
  },
  targetType: {
    type: String,
    required: true,
    enum: ["user", "course"],
  },
  targetId: {
    type: String,
    required: true,
  },
  targetName: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Store additional details like old/new values
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for efficient querying
AuditLogSchema.index({ adminId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);

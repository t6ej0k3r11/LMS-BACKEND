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
      "user_reactivated",
      "course_approved",
      "course_rejected",
      "course_pending",
      "course_deleted",
      "bulk_user_action",
      "instructor_approved",
      "instructor_rejected",
      "question_created",
      "question_updated",
      "question_deleted",
    ],
  },
  targetType: {
    type: String,
    required: true,
    enum: ["user", "course", "question"],
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

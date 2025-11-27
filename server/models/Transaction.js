const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    platformCommission: {
      type: Number,
      required: true,
      min: 0,
    },
    instructorEarnings: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["success", "refund"],
      default: "success",
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
TransactionSchema.index({ instructorId: 1 });
TransactionSchema.index({ courseId: 1 });
TransactionSchema.index({ studentId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);

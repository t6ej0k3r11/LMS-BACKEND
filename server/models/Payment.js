const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "BDT",
      enum: ["BDT"],
    },
    method: {
      type: String,
      required: true,
      enum: [
        "sslcommerz",
        "aamarpay",
        "bkash_manual",
        "nagad_manual",
        "bank_transfer",
        "cash_office",
      ],
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "verified", "failed", "cancelled"],
      default: "pending",
    },
    offlineProofURL: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          return /^https?:\/\/.+/.test(v);
        },
        message: "Offline proof URL must be a valid URL",
      },
    },
    adminNote: {
      type: String,
      trim: true,
    },
    referenceNote: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ courseId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ userId: 1, courseId: 1 });
PaymentSchema.index({ status: 1, method: 1 });

module.exports = mongoose.model("Payment", PaymentSchema);

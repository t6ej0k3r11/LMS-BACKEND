const mongoose = require("mongoose");

const PayoutSchema = new mongoose.Schema(
  {
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "paid"],
      default: "pending",
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
PayoutSchema.index({ instructorId: 1 });
PayoutSchema.index({ status: 1 });
PayoutSchema.index({ createdAt: 1 });

module.exports = mongoose.model("Payout", PayoutSchema);

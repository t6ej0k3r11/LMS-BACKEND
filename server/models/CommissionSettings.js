const mongoose = require("mongoose");

const CommissionSettingsSchema = new mongoose.Schema(
  {
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for global settings
    },
    globalCommissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 30, // Default 30% platform commission
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes
CommissionSettingsSchema.index({ instructorId: 1 });

// Ensure only one global setting exists (where instructorId is null)
CommissionSettingsSchema.pre("save", async function (next) {
  if (!this.instructorId) {
    const existingGlobal = await this.constructor.findOne({
      instructorId: null,
    });
    if (
      existingGlobal &&
      existingGlobal._id.toString() !== this._id.toString()
    ) {
      return next(new Error("Global commission settings already exist"));
    }
  }
  next();
});

module.exports = mongoose.model("CommissionSettings", CommissionSettingsSchema);

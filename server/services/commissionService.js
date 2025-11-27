const CommissionSettings = require("../models/CommissionSettings");

class CommissionService {
  // Get commission percentage for an instructor (or global if not set)
  static async getCommissionPercent(instructorId = null) {
    try {
      // First try to get instructor-specific commission
      if (instructorId) {
        const instructorSetting = await CommissionSettings.findOne({
          instructorId,
        });
        if (instructorSetting) {
          return instructorSetting.globalCommissionPercent;
        }
      }

      // Fall back to global commission
      const globalSetting = await CommissionSettings.findOne({
        instructorId: null,
      });
      return globalSetting ? globalSetting.globalCommissionPercent : 30; // Default 30%
    } catch (error) {
      console.error("Error getting commission percent:", error);
      return 30; // Default fallback
    }
  }

  // Calculate commission and earnings
  static calculateEarnings(amount, commissionPercent) {
    const platformCommission = (amount * commissionPercent) / 100;
    const instructorEarnings = amount - platformCommission;

    return {
      amount,
      commissionPercent,
      platformCommission: Math.round(platformCommission * 100) / 100, // Round to 2 decimal places
      instructorEarnings: Math.round(instructorEarnings * 100) / 100,
    };
  }

  // Create or update global commission settings
  static async setGlobalCommission(percent) {
    try {
      const existing = await CommissionSettings.findOne({ instructorId: null });
      if (existing) {
        existing.globalCommissionPercent = percent;
        await existing.save();
        return existing;
      } else {
        const newSetting = new CommissionSettings({
          instructorId: null,
          globalCommissionPercent: percent,
        });
        await newSetting.save();
        return newSetting;
      }
    } catch (error) {
      console.error("Error setting global commission:", error);
      throw error;
    }
  }

  // Set instructor-specific commission
  static async setInstructorCommission(instructorId, percent) {
    try {
      const existing = await CommissionSettings.findOne({ instructorId });
      if (existing) {
        existing.globalCommissionPercent = percent;
        await existing.save();
        return existing;
      } else {
        const newSetting = new CommissionSettings({
          instructorId,
          globalCommissionPercent: percent,
        });
        await newSetting.save();
        return newSetting;
      }
    } catch (error) {
      console.error("Error setting instructor commission:", error);
      throw error;
    }
  }
}

module.exports = CommissionService;

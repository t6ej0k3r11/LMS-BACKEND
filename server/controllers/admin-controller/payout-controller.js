const Payout = require("../../models/Payout");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");

const createPayout = async (req, res) => {
  try {
    const { instructorId, amount } = req.body;

    // Validate instructor exists
    const instructor = await User.findById(instructorId);
    if (!instructor || instructor.role !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Check if instructor has available earnings
    const transactions = await Transaction.find({
      instructorId,
      status: "success",
    });

    const totalEarnings = transactions.reduce(
      (sum, t) => sum + t.instructorEarnings,
      0
    );

    const existingPayouts = await Payout.find({
      instructorId,
      $or: [{ status: "pending" }, { status: "paid" }],
    });

    const totalPaidOut = existingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const availableForPayout = totalEarnings - totalPaidOut;

    if (amount > availableForPayout) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds available earnings. Available: ${availableForPayout}`,
      });
    }

    const payout = new Payout({
      instructorId,
      amount,
    });

    await payout.save();

    res.status(201).json({
      success: true,
      data: payout,
      message: "Payout created successfully",
    });
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payout",
    });
  }
};

const markPayoutAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const payout = await Payout.findById(id);
    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    if (payout.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payout is already marked as paid",
      });
    }

    payout.status = "paid";
    payout.paidAt = new Date();
    await payout.save();

    res.status(200).json({
      success: true,
      data: payout,
      message: "Payout marked as paid successfully",
    });
  } catch (error) {
    console.error("Error marking payout as paid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark payout as paid",
    });
  }
};

const getPayouts = async (req, res) => {
  try {
    const { status, instructorId } = req.query;

    let filter = {};
    if (status) {
      filter.status = status;
    }
    if (instructorId) {
      filter.instructorId = instructorId;
    }

    const payouts = await Payout.find(filter)
      .populate("instructorId", "userName userEmail")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payouts,
    });
  } catch (error) {
    console.error("Error getting payouts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payouts",
    });
  }
};

const getPayoutById = async (req, res) => {
  try {
    const { id } = req.params;

    const payout = await Payout.findById(id).populate(
      "instructorId",
      "userName userEmail"
    );

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payout,
    });
  } catch (error) {
    console.error("Error getting payout:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payout",
    });
  }
};

module.exports = {
  createPayout,
  markPayoutAsPaid,
  getPayouts,
  getPayoutById,
};

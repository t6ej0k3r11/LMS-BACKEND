const Transaction = require("../../models/Transaction");
const Payout = require("../../models/Payout");
const Course = require("../../models/Course");

const getEarningsSummary = async (req, res) => {
  try {
    const instructorId = req.user._id;

    // Get all successful transactions for this instructor
    const transactions = await Transaction.find({
      instructorId,
      status: "success",
    });

    // Calculate totals
    const totalEarnings = transactions.reduce(
      (sum, t) => sum + t.instructorEarnings,
      0
    );
    const totalPlatformCommission = transactions.reduce(
      (sum, t) => sum + t.platformCommission,
      0
    );
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Get pending payouts
    const pendingPayouts = await Payout.find({
      instructorId,
      status: "pending",
    });
    const totalPendingPayouts = pendingPayouts.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    // Get paid payouts
    const paidPayouts = await Payout.find({
      instructorId,
      status: "paid",
    });
    const totalPaidOut = paidPayouts.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        totalRevenue,
        platformCommission: totalPlatformCommission,
        pendingPayouts: totalPendingPayouts,
        paidOut: totalPaidOut,
        availableForPayout: totalEarnings - totalPaidOut - totalPendingPayouts,
        transactionCount: transactions.length,
      },
    });
  } catch (error) {
    console.error("Error getting earnings summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get earnings summary",
    });
  }
};

const getEarningsByCourse = async (req, res) => {
  try {
    const instructorId = req.user._id;

    // Aggregate earnings by course
    const courseEarnings = await Transaction.aggregate([
      {
        $match: {
          instructorId,
          status: "success",
        },
      },
      {
        $group: {
          _id: "$courseId",
          totalEarnings: { $sum: "$instructorEarnings" },
          totalRevenue: { $sum: "$amount" },
          platformCommission: { $sum: "$platformCommission" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      {
        $unwind: "$course",
      },
      {
        $project: {
          courseId: "$_id",
          courseTitle: "$course.title",
          totalEarnings: 1,
          totalRevenue: 1,
          platformCommission: 1,
          transactionCount: 1,
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: courseEarnings,
    });
  } catch (error) {
    console.error("Error getting earnings by course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get earnings by course",
    });
  }
};

const getEarningsGraphData = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const { period = "monthly" } = req.query; // daily, weekly, monthly

    let groupBy;
    if (period === "daily") {
      groupBy = {
        $dateToString: {
          format: "%Y-%m-%d",
          date: "$createdAt",
        },
      };
    } else if (period === "weekly") {
      groupBy = {
        $dateToString: {
          format: "%Y-W%V",
          date: "$createdAt",
        },
      };
    } else {
      groupBy = {
        $dateToString: {
          format: "%Y-%m",
          date: "$createdAt",
        },
      };
    }

    const graphData = await Transaction.aggregate([
      {
        $match: {
          instructorId,
          status: "success",
        },
      },
      {
        $group: {
          _id: groupBy,
          earnings: { $sum: "$instructorEarnings" },
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: graphData,
    });
  } catch (error) {
    console.error("Error getting earnings graph data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get earnings graph data",
    });
  }
};

module.exports = {
  getEarningsSummary,
  getEarningsByCourse,
  getEarningsGraphData,
};

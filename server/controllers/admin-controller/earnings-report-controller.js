const Transaction = require("../../models/Transaction");
const Payout = require("../../models/Payout");
const User = require("../../models/User");
const Course = require("../../models/Course");

const getRevenueReport = async (req, res) => {
  try {
    const { period = "monthly", startDate, endDate } = req.query;

    let matchConditions = { status: "success" };
    if (startDate && endDate) {
      matchConditions.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

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

    const revenueData = await Transaction.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: "$amount" },
          platformCommission: { $sum: "$platformCommission" },
          instructorEarnings: { $sum: "$instructorEarnings" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    console.error("Error getting revenue report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get revenue report",
    });
  }
};

const getInstructorEarningsReport = async (req, res) => {
  try {
    const instructorEarnings = await Transaction.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: "$instructorId",
          totalEarnings: { $sum: "$instructorEarnings" },
          totalRevenue: { $sum: "$amount" },
          platformCommission: { $sum: "$platformCommission" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "instructor",
        },
      },
      {
        $unwind: "$instructor",
      },
      {
        $project: {
          instructorId: "$_id",
          instructorName: "$instructor.userName",
          instructorEmail: "$instructor.userEmail",
          totalEarnings: 1,
          totalRevenue: 1,
          platformCommission: 1,
          transactionCount: 1,
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: instructorEarnings,
    });
  } catch (error) {
    console.error("Error getting instructor earnings report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get instructor earnings report",
    });
  }
};

const getCourseEarningsReport = async (req, res) => {
  try {
    const courseEarnings = await Transaction.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: "$courseId",
          totalRevenue: { $sum: "$amount" },
          platformCommission: { $sum: "$platformCommission" },
          instructorEarnings: { $sum: "$instructorEarnings" },
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
        $lookup: {
          from: "users",
          localField: "course.instructorId",
          foreignField: "_id",
          as: "instructor",
        },
      },
      {
        $unwind: "$instructor",
      },
      {
        $project: {
          courseId: "$_id",
          courseTitle: "$course.title",
          instructorName: "$instructor.userName",
          totalRevenue: 1,
          platformCommission: 1,
          instructorEarnings: 1,
          transactionCount: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: courseEarnings,
    });
  } catch (error) {
    console.error("Error getting course earnings report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get course earnings report",
    });
  }
};

const getEarningsSummary = async (req, res) => {
  try {
    // Total platform metrics
    const totalTransactions = await Transaction.countDocuments({
      status: "success",
    });
    const totalRevenue = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalPlatformCommission = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$platformCommission" } } },
    ]);
    const totalInstructorEarnings = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$instructorEarnings" } } },
    ]);

    // Payout statistics
    const totalPayouts = await Payout.countDocuments({ status: "paid" });
    const totalPaidOut = await Payout.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Pending payouts
    const pendingPayouts = await Payout.countDocuments({ status: "pending" });
    const pendingAmount = await Payout.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const summary = {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalPlatformCommission: totalPlatformCommission[0]?.total || 0,
      totalInstructorEarnings: totalInstructorEarnings[0]?.total || 0,
      totalTransactions,
      totalPayouts,
      totalPaidOut: totalPaidOut[0]?.total || 0,
      pendingPayouts,
      pendingAmount: pendingAmount[0]?.total || 0,
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error getting earnings summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get earnings summary",
    });
  }
};

module.exports = {
  getRevenueReport,
  getInstructorEarningsReport,
  getCourseEarningsReport,
  getEarningsSummary,
};

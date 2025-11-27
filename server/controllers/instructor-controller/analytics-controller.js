const Course = require("../../models/Course");
const CourseProgress = require("../../models/CourseProgress");
const Transaction = require("../../models/Transaction");

const getAnalyticsSummary = async (req, res) => {
  try {
    const instructorId = req.user._id;
    console.log("Analytics API called for instructor:", instructorId);

    // Get all courses by this instructor
    const courses = await Course.find({
      instructorId: instructorId.toString(),
      status: "published",
      approvalStatus: "approved",
    });
    console.log(`Found ${courses.length} published courses for instructor`);

    const courseIds = courses.map((course) => course._id);

    // Total views (using enrollments as proxy)
    const totalViews = courses.reduce(
      (sum, course) => sum + course.students.length,
      0
    );

    // Active students (current enrollments)
    const activeStudents = totalViews;

    // Average completion rate
    let avgCompletion = 0;
    if (courseIds.length > 0) {
      const progressData = await CourseProgress.find({
        courseId: { $in: courseIds },
      });

      const totalProgress = progressData.reduce(
        (sum, progress) => sum + progress.overallProgressPercentage,
        0
      );
      avgCompletion =
        progressData.length > 0
          ? Math.round(totalProgress / progressData.length)
          : 0;
    }

    // Average rating (placeholder - not implemented yet)
    const avgRating = 4.8; // Placeholder

    // Course performance data for chart
    const coursePerformance = await Promise.all(
      courses.map(async (course) => {
        const enrollments = course.students.length;
        const progressData = await CourseProgress.find({
          courseId: course._id,
        });
        const completions = progressData.filter((p) => p.isCompleted).length;
        const completionRate =
          enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0;

        return {
          courseId: course._id,
          title: course.title,
          enrollments,
          completions,
          completionRate,
          revenue: course.pricing * enrollments,
        };
      })
    );

    // Student engagement data (time-based)
    const monthlyEngagement = await CourseProgress.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$lastUpdated",
            },
          },
          activeStudents: { $sum: 1 },
          avgProgress: { $avg: "$overallProgressPercentage" },
          completions: {
            $sum: { $cond: ["$isCompleted", 1, 0] },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $limit: 12, // Last 12 months
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalViews,
        avgCompletion,
        activeStudents,
        avgRating,
        coursePerformance,
        monthlyEngagement,
      },
    });
  } catch (error) {
    console.error("Error getting analytics summary:", error);
    console.error("Error stack:", error.stack);
    console.error("Instructor ID:", req.user?._id);
    res.status(500).json({
      success: false,
      message: "Failed to get analytics summary",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getCourseAnalytics = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const { courseId } = req.params;

    // Verify course belongs to instructor
    const course = await Course.findOne({
      _id: courseId,
      instructorId: instructorId.toString(),
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found or access denied",
      });
    }

    // Get enrollment data
    const enrollments = course.students.length;

    // Get progress data
    const progressData = await CourseProgress.find({ courseId });

    const completions = progressData.filter((p) => p.isCompleted).length;
    const avgProgress =
      progressData.length > 0
        ? Math.round(
            progressData.reduce(
              (sum, p) => sum + p.overallProgressPercentage,
              0
            ) / progressData.length
          )
        : 0;

    // Get revenue data
    const transactions = await Transaction.find({
      courseId,
      status: "success",
    });

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalEarnings = transactions.reduce(
      (sum, t) => sum + t.instructorEarnings,
      0
    );

    // Monthly progress
    const monthlyProgress = await CourseProgress.aggregate([
      {
        $match: { courseId: course._id },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$lastUpdated",
            },
          },
          students: { $sum: 1 },
          avgProgress: { $avg: "$overallProgressPercentage" },
          completions: {
            $sum: { $cond: ["$isCompleted", 1, 0] },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        course: {
          id: course._id,
          title: course.title,
          enrollments,
          completions,
          avgProgress,
          totalRevenue,
          totalEarnings,
        },
        monthlyProgress,
      },
    });
  } catch (error) {
    console.error("Error getting course analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get course analytics",
    });
  }
};

module.exports = {
  getAnalyticsSummary,
  getCourseAnalytics,
};

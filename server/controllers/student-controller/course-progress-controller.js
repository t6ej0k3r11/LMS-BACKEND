const mongoose = require("mongoose");
const UserCourseProgress = require("../../models/CourseProgress");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");

// Helper function to calculate overall course progress
const calculateOverallProgress = async (progress, courseId) => {
  try {
    // Get all quizzes for the course
    const quizzes = await Quiz.find({ courseId });
    const totalQuizzes = quizzes.length;

    // Get completed quiz attempts for this user and course
    const completedQuizAttempts = await QuizAttempt.find({
      courseId,
      studentId: progress.userId,
      passed: true,
      status: "completed",
    });

    const completedQuizzesCount = completedQuizAttempts.length;

    // Update completed quizzes in progress
    progress.completedQuizzes = completedQuizAttempts.map(
      (attempt) => attempt.quizId
    );

    // Calculate weights: videos 50%, quizzes 50%
    const videoWeight = 0.5;
    const quizWeight = 0.5;

    const videoProgress = progress.videoProgressPercentage || 0;
    const quizProgress =
      totalQuizzes > 0 ? (completedQuizzesCount / totalQuizzes) * 100 : 100;

    progress.overallProgressPercentage = Math.round(
      videoProgress * videoWeight + quizProgress * quizWeight
    );

    // Check if course is completed
    const allVideosCompleted = progress.videoProgressPercentage >= 100;
    const allQuizzesCompleted = completedQuizzesCount === totalQuizzes;

    if (allVideosCompleted && allQuizzesCompleted && !progress.isCompleted) {
      progress.isCompleted = true;
      progress.completionDate = new Date();
    }

    return progress;
  } catch (error) {
    console.error("Error calculating overall progress:", error);
    return progress;
  }
};

//mark current lecture as viewed (add to completedLessons)
const markCurrentLectureAsViewed = async (req, res) => {
  try {
    const { userId, courseId, lectureId, isRewatch } = req.body;

    let progress = await UserCourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new UserCourseProgress({
        userId,
        courseId,
        completedLessons: [lectureId],
        videoProgressPercentage: 0,
        overallProgressPercentage: 0,
      });
    } else {
      // Add lessonId to completedLessons if not already present (idempotent)
      if (!progress.completedLessons.includes(lectureId)) {
        progress.completedLessons.push(lectureId);
      }
    }

    // Recalculate video progress percentage
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const totalLessons = course.curriculum.length;
    progress.videoProgressPercentage = Math.round(
      (progress.completedLessons.length / totalLessons) * 100
    );

    // Calculate overall progress (videos + quizzes)
    await calculateOverallProgress(progress, courseId);

    progress.lastUpdated = new Date();
    await progress.save();

    res.status(200).json({
      success: true,
      message: isRewatch
        ? "Lecture rewatch counted"
        : "Lecture marked as viewed",
      data: progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

//get current course progress (legacy - for backward compatibility)
const getCurrentCourseProgress = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const studentPurchasedCourses = await StudentCourses.findOne({ userId });

    const isCurrentCoursePurchasedByCurrentUserOrNot =
      studentPurchasedCourses?.courses?.findIndex(
        (item) => item.courseId === courseId
      ) > -1;

    if (!isCurrentCoursePurchasedByCurrentUserOrNot) {
      return res.status(200).json({
        success: true,
        data: {
          isPurchased: false,
        },
        message: "You need to purchase this course to access it.",
      });
    }

    const currentUserCourseProgress = await UserCourseProgress.findOne({
      userId,
      courseId,
    });

    if (!currentUserCourseProgress) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "No progress found, you can start watching the course",
        data: {
          courseDetails: course,
          progress: [],
          isPurchased: true,
        },
      });
    }

    const courseDetails = await Course.findById(courseId);

    // Convert completedLessons to legacy format for backward compatibility
    const progress = currentUserCourseProgress.completedLessons.map(
      (lessonId) => ({
        lectureId: lessonId,
        viewed: true,
        progressValue: 1,
        dateViewed: currentUserCourseProgress.lastUpdated,
      })
    );

    // Calculate overall progress for backward compatibility
    await calculateOverallProgress(currentUserCourseProgress, courseId);

    res.status(200).json({
      success: true,
      data: {
        courseDetails,
        progress: progress,
        quizzesProgress: [], // Keep for backward compatibility
        completed: currentUserCourseProgress.isCompleted,
        completionDate: currentUserCourseProgress.completionDate,
        progressPercentage: currentUserCourseProgress.overallProgressPercentage, // Overall progress
        videoProgressPercentage:
          currentUserCourseProgress.videoProgressPercentage, // Video-only progress
        isPurchased: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

// Get progress for authenticated user (new simplified endpoint)
const getUserCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id; // From auth middleware

    const studentPurchasedCourses = await StudentCourses.findOne({ userId });

    const isCurrentCoursePurchasedByCurrentUserOrNot =
      studentPurchasedCourses?.courses?.findIndex(
        (item) => item.courseId === courseId
      ) > -1;

    if (!isCurrentCoursePurchasedByCurrentUserOrNot) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    let progress = await UserCourseProgress.findOne({ userId, courseId });

    if (!progress) {
      progress = new UserCourseProgress({
        userId,
        courseId,
        completedLessons: [],
        videoProgressPercentage: 0,
        overallProgressPercentage: 0,
      });
      await progress.save();
    }

    // Ensure overall progress is calculated
    await calculateOverallProgress(progress, courseId);
    await progress.save();

    res.status(200).json({
      success: true,
      data: {
        completedLessons: progress.completedLessons,
        completedQuizzes: progress.completedQuizzes,
        videoProgressPercentage: progress.videoProgressPercentage,
        overallProgressPercentage: progress.overallProgressPercentage,
        isCompleted: progress.isCompleted,
        completionDate: progress.completionDate,
        lastUpdated: progress.lastUpdated,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

//reset course progress
const resetCurrentCourseProgress = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    const progress = await UserCourseProgress.findOne({ userId, courseId });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress not found!",
      });
    }

    progress.completedLessons = [];
    progress.completedQuizzes = [];
    progress.videoProgressPercentage = 0;
    progress.overallProgressPercentage = 0;
    progress.isCompleted = false;
    progress.completionDate = null;
    progress.lastUpdated = new Date();

    await progress.save();

    res.status(200).json({
      success: true,
      message: "Course progress has been reset",
      data: progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

// Update quiz progress when a quiz is completed
const updateQuizProgress = async (req, res) => {
  try {
    const { userId, courseId, quizId, score, passed } = req.body;

    let progress = await UserCourseProgress.findOne({ userId, courseId });

    if (!progress) {
      progress = new UserCourseProgress({
        userId,
        courseId,
        completedLessons: [],
        videoProgressPercentage: 0,
        overallProgressPercentage: 0,
      });
    }

    // Add quiz to completed quizzes if not already present and passed
    if (passed && !progress.completedQuizzes.includes(quizId)) {
      progress.completedQuizzes.push(quizId);
    }

    // Calculate overall progress
    await calculateOverallProgress(progress, courseId);

    progress.lastUpdated = new Date();
    await progress.save();

    if (res) {
      res.status(200).json({
        success: true,
        message: "Quiz progress updated",
        data: progress,
      });
    }
  } catch (error) {
    console.error("Error updating quiz progress:", error);
    if (res) {
      res.status(500).json({
        success: false,
        message: "Some error occured!",
      });
    }
  }
};

module.exports = {
  markCurrentLectureAsViewed,
  getCurrentCourseProgress,
  getUserCourseProgress,
  resetCurrentCourseProgress,
  updateQuizProgress,
};

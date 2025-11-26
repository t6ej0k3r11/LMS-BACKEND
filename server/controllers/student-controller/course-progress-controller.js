const mongoose = require("mongoose");
const UserCourseProgress = require("../../models/CourseProgress");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");

// Helper function to calculate overall course progress
const calculateOverallProgress = async (userId, courseId) => {
  const course = await Course.findById(courseId).populate("lessons quizzes");
  const progress = await UserCourseProgress.findOne({ userId, courseId });

  if (!progress) {
    throw new Error("Progress not found");
  }

  const totalLessons = course.lessons?.length || course.curriculum.length;
  const completedLessons = Object.values(progress.lectures || {}).filter(
    (s) => s === "completed"
  ).length;

  const totalQuizzes =
    course.quizzes?.length || (await Quiz.find({ courseId })).length;
  const completedQuizzes = Object.values(progress.quizzes || {}).filter(
    (s) => s === "completed"
  ).length;

  const totalItems = totalLessons + totalQuizzes;
  const completedItems = completedLessons + completedQuizzes;

  const progressPercentage =
    totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  // ✅ Set isCompleted if everything is done
  const isCompleted = completedItems === totalItems;

  progress.percentage = progressPercentage;
  progress.isCompleted = isCompleted;

  if (isCompleted && !progress.completionDate) {
    progress.completionDate = new Date();
  }

  await progress.save();

  return progress;
};

//mark current lecture as viewed (add to completedLessons)
const markCurrentLectureAsViewed = async (req, res) => {
  try {
    const { courseId, lectureId, isRewatch } = req.body;
    const userId = req.user._id;

    let progress = await UserCourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new UserCourseProgress({
        userId,
        courseId,
        completedLessons: [lectureId],
        videoProgressPercentage: 0,
        overallProgressPercentage: 0,
      });
    }

    // Mark lecture as completed in the map
    progress.lectures.set(lectureId, "completed");

    // Add to completedLessons for backward compatibility
    if (!progress.completedLessons.includes(lectureId)) {
      progress.completedLessons.push(lectureId);
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
    progress = await calculateOverallProgress(userId, courseId);

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
    const { courseId } = req.params;
    const userId = req.user._id;

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
    await calculateOverallProgress(userId, courseId);

    res.status(200).json({
      success: true,
      data: {
        courseDetails,
        progress: progress,
        quizzesProgress: [], // Keep for backward compatibility
        completed: currentUserCourseProgress.isCompleted,
        completionDate: currentUserCourseProgress.completionDate,
        progressPercentage:
          currentUserCourseProgress.percentage ||
          currentUserCourseProgress.overallProgressPercentage, // Overall progress
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
    progress = await calculateOverallProgress(userId, courseId);

    const courseDetails = await Course.findById(courseId);

    res.status(200).json({
      success: true,
      data: {
        completedLessons: progress.completedLessons,
        completedQuizzes: progress.completedQuizzes,
        lectures: Object.fromEntries(progress.lectures),
        quizzes: Object.fromEntries(progress.quizzes),
        videoProgressPercentage: progress.videoProgressPercentage,
        overallProgressPercentage:
          progress.percentage || progress.overallProgressPercentage,
        isCompleted: progress.isCompleted,
        completionDate: progress.completionDate,
        lastUpdated: progress.lastUpdated,
        courseDetails,
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
    const studentId = req.user._id;
    const { courseId } = req.body;

    // Check if the student has purchased the course
    const studentPurchasedCourses = await StudentCourses.findOne({
      userId: studentId,
    });
    const isCurrentCoursePurchasedByCurrentUserOrNot =
      studentPurchasedCourses?.courses?.findIndex(
        (item) => item.courseId === courseId
      ) > -1;

    if (!isCurrentCoursePurchasedByCurrentUserOrNot) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reset this course.",
      });
    }

    // Enforce ownership: validate that a course-progress record exists for (studentId, courseId)
    const progress = await UserCourseProgress.findOne({
      userId: studentId,
      courseId,
    });

    if (!progress) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reset this course.",
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
const updateQuizProgress = async (userId, courseId, quizId, score, passed) => {
  try {
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

    // Mark quiz as completed in the map if passed
    if (passed) {
      progress.quizzes.set(quizId, "completed");
    }

    // Add to completedQuizzes for backward compatibility
    if (passed && !progress.completedQuizzes.includes(quizId)) {
      progress.completedQuizzes.push(quizId);
    }

    // Calculate overall progress
    progress = await calculateOverallProgress(userId, courseId);

    return progress;
  } catch (error) {
    console.error("Error updating quiz progress:", error);
    throw error;
  }
};

// Update lecture progress (auto-save)
const updateLectureProgress = async (req, res) => {
  try {
    const studentId = req.user._id; // Use authenticated user only
    const { courseId, lectureId, status = "completed" } = req.body;

    if (!courseId || !lectureId) {
      return res.status(400).json({
        success: false,
        message: "courseId and lectureId are required",
      });
    }

    // Find or create the course progress document
    const progress = await UserCourseProgress.findOneAndUpdate(
      { userId: studentId, courseId },
      { $set: { [`lectures.${lectureId}`]: status } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: "Lecture progress updated successfully",
      progress,
    });
  } catch (error) {
    console.error("Lecture progress update error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  markCurrentLectureAsViewed,
  getCurrentCourseProgress,
  getUserCourseProgress,
  resetCurrentCourseProgress,
  updateQuizProgress,
  updateLectureProgress,
};

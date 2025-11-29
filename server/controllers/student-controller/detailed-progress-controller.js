const DetailedCourseProgress = require("../../models/DetailedProgress");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const Quiz = require("../../models/Quiz");

// Utility function to validate user has access to course
const validateCourseAccess = async (userId, courseId) => {
  const studentPurchasedCourses = await StudentCourses.findOne({ userId });
  const hasAccess = studentPurchasedCourses?.courses?.some(
    item => item.courseId.toString() === courseId
  );
  return hasAccess;
};

// 1. Update Lecture Progress (Auto-save video progress)
const updateLectureProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, lectureId, progressPercent, lastTimestamp, duration, localProgress } = req.body;

    // Validation
    if (!courseId || !lectureId || progressPercent === undefined) {
      return res.status(400).json({
        success: false,
        message: "courseId, lectureId, and progressPercent are required",
      });
    }

    // Check course access
    const hasAccess = await validateCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    // Find or create progress document
    let progress = await DetailedCourseProgress.findOne({ userId, courseId });
    
    if (!progress) {
      progress = new DetailedCourseProgress({
        userId,
        courseId,
        lectures: [],
        quizzes: [],
      });
    }

    // Get course data for calculations
    const course = await Course.findById(courseId).populate("lessons quizzes");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Update lecture progress
    const lectureProgress = progress.updateLectureProgress(lectureId, {
      progressPercent,
      lastTimestamp: lastTimestamp || 0,
      duration: duration || 0,
    });

    // Calculate total counts
    const totalLectures = course.curriculum.length || course.lessons?.length || 0;
    const totalQuizzes = course.quizzes?.length || 0;

    // Calculate overall progress
    const calculatedProgress = DetailedCourseProgress.calculateProgress(
      {
        lectures: progress.lectures,
        quizzes: progress.quizzes,
      },
      {
        totalLectures,
        totalQuizzes,
      }
    );

    // Update calculated fields
    Object.assign(progress, {
      ...calculatedProgress,
      totalLecturesCount: totalLectures,
      totalQuizzesCount: totalQuizzes,
    });

    // Save progress
    await progress.save();

    // Merge with localStorage progress if provided
    let mergedProgress = progress;
    if (localProgress && Array.isArray(localProgress)) {
      // Merge local progress data
      for (const localLecture of localProgress) {
        const existingLecture = progress.lectures.find(
          l => l.lectureId.toString() === localLecture.lectureId
        );
        
        if (!existingLecture || localLecture.progressPercent > existingLecture.progressPercent) {
          progress.updateLectureProgress(localLecture.lectureId, {
            progressPercent: localLecture.progressPercent,
            lastTimestamp: localLecture.lastTimestamp || 0,
            duration: localLecture.duration || 0,
          });
        }
      }

      // Recalculate after merge
      const mergedCalculatedProgress = DetailedCourseProgress.calculateProgress(
        {
          lectures: progress.lectures,
          quizzes: progress.quizzes,
        },
        {
          totalLectures,
          totalQuizzes,
        }
      );

      Object.assign(progress, mergedCalculatedProgress);
      await progress.save();
      mergedProgress = progress;
    }

    res.status(200).json({
      success: true,
      message: "Lecture progress updated successfully",
      data: {
        lectureProgress,
        courseProgress: {
          overallProgressPercent: mergedProgress.overallProgressPercent,
          videoProgressPercent: mergedProgress.videoProgressPercent,
          completedLecturesCount: mergedProgress.completedLecturesCount,
          totalLecturesCount: mergedProgress.totalLecturesCount,
          certificateEligible: mergedProgress.certificateEligible,
          certificateProgressPercent: mergedProgress.certificateProgressPercent,
        },
      },
    });
  } catch (error) {
    console.error("Error updating lecture progress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 2. Get Course Progress (Complete progress overview)
const getCourseProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    // Check course access
    const hasAccess = await validateCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    // Get detailed progress
    let progress = await DetailedCourseProgress.findOne({ userId, courseId })
      .populate("lectures.lectureId")
      .populate("quizzes.quizId");

    if (!progress) {
      // Create new progress document if none exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      progress = new DetailedCourseProgress({
        userId,
        courseId,
        lectures: [],
        quizzes: [],
        totalLecturesCount: course.curriculum.length || course.lessons?.length || 0,
        totalQuizzesCount: course.quizzes?.length || 0,
      });
      await progress.save();
    }

    // Ensure progress is calculated
    if (progress.lectures.length === 0 && progress.quizzes.length === 0) {
      const course = await Course.findById(courseId);
      const calculatedProgress = DetailedCourseProgress.calculateProgress(
        { lectures: [], quizzes: [] },
        {
          totalLectures: course.curriculum.length || course.lessons?.length || 0,
          totalQuizzes: course.quizzes?.length || 0,
        }
      );
      
      Object.assign(progress, calculatedProgress);
      await progress.save();
    }

    // Get course details
    const courseDetails = await Course.findById(courseId);

    res.status(200).json({
      success: true,
      data: {
        courseId,
        courseDetails,
        progress: {
          overallProgressPercent: progress.overallProgressPercent,
          videoProgressPercent: progress.videoProgressPercent,
          quizProgressPercent: progress.quizProgressPercent,
          completedLecturesCount: progress.completedLecturesCount,
          totalLecturesCount: progress.totalLecturesCount,
          completedQuizzesCount: progress.completedQuizzesCount,
          totalQuizzesCount: progress.totalQuizzesCount,
          isCompleted: progress.isCompleted,
          completionDate: progress.completionDate,
          certificateEligible: progress.certificateEligible,
          certificateProgressPercent: progress.certificateProgressPercent,
          lastAccessedAt: progress.lastAccessedAt,
        },
        detailedProgress: {
          lectures: progress.lectures.map(lecture => ({
            lectureId: lecture.lectureId._id,
            lectureTitle: lecture.lectureId.title || lecture.lectureId.name,
            progressPercent: lecture.progressPercent,
            lastTimestamp: lecture.lastTimestamp,
            duration: lecture.duration,
            completed: lecture.completed,
            completedAt: lecture.completedAt,
            isRewatch: lecture.isRewatch,
          })),
          quizzes: progress.quizzes.map(quiz => ({
            quizId: quiz.quizId._id,
            quizTitle: quiz.quizId.title,
            score: quiz.score,
            passed: quiz.passed,
            completed: quiz.completed,
            completedAt: quiz.completedAt,
            attempts: quiz.attempts,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Error getting course progress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 3. Get Certificate Progress
const getCertificateProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    // Check course access
    const hasAccess = await validateCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    // Get progress
    const progress = await DetailedCourseProgress.findOne({ userId, courseId });

    if (!progress) {
      return res.status(200).json({
        success: true,
        data: {
          certificateEligible: false,
          certificateProgressPercent: 0,
          completedLecturesCount: 0,
          totalLecturesCount: 0,
          requirements: {
            minimumProgress: 90,
            description: "Complete 90% of lectures to be eligible for certificate",
          },
        },
      });
    }

    const course = await Course.findById(courseId);
    const totalLectures = course.curriculum.length || course.lessons?.length || 0;

    res.status(200).json({
      success: true,
      data: {
        certificateEligible: progress.certificateEligible,
        certificateProgressPercent: progress.certificateProgressPercent,
        completedLecturesCount: progress.completedLecturesCount,
        totalLecturesCount: totalLectures,
        requirements: {
          minimumProgress: 90,
          description: "Complete 90% of lectures to be eligible for certificate",
        },
        status: progress.certificateEligible ? "Eligible" : "Not Eligible",
      },
    });
  } catch (error) {
    console.error("Error getting certificate progress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 4. Update Quiz Progress
const updateQuizProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, quizId, score, passed, completed } = req.body;

    // Validation
    if (!courseId || !quizId) {
      return res.status(400).json({
        success: false,
        message: "courseId and quizId are required",
      });
    }

    // Check course access
    const hasAccess = await validateCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    // Find or create progress document
    let progress = await DetailedCourseProgress.findOne({ userId, courseId });
    
    if (!progress) {
      progress = new DetailedCourseProgress({
        userId,
        courseId,
        lectures: [],
        quizzes: [],
      });
    }

    // Update quiz progress
    const quizProgress = progress.updateQuizProgress(quizId, {
      score: score || 0,
      passed: passed || false,
      completed: completed || passed || false,
    });

    // Get course data for calculations
    const course = await Course.findById(courseId).populate("lessons quizzes");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Calculate total counts
    const totalLectures = course.curriculum.length || course.lessons?.length || 0;
    const totalQuizzes = course.quizzes?.length || 0;

    // Calculate overall progress
    const calculatedProgress = DetailedCourseProgress.calculateProgress(
      {
        lectures: progress.lectures,
        quizzes: progress.quizzes,
      },
      {
        totalLectures,
        totalQuizzes,
      }
    );

    // Update calculated fields
    Object.assign(progress, {
      ...calculatedProgress,
      totalLecturesCount: totalLectures,
      totalQuizzesCount: totalQuizzes,
    });

    // Save progress
    await progress.save();

    res.status(200).json({
      success: true,
      message: "Quiz progress updated successfully",
      data: {
        quizProgress,
        courseProgress: {
          overallProgressPercent: progress.overallProgressPercent,
          quizProgressPercent: progress.quizProgressPercent,
          completedQuizzesCount: progress.completedQuizzesCount,
          totalQuizzesCount: progress.totalQuizzesCount,
        },
      },
    });
  } catch (error) {
    console.error("Error updating quiz progress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 5. Merge LocalStorage Progress
const mergeLocalProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, localProgress } = req.body;

    // Validation
    if (!courseId || !localProgress) {
      return res.status(400).json({
        success: false,
        message: "courseId and localProgress are required",
      });
    }

    // Check course access
    const hasAccess = await validateCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase this course to access it.",
      });
    }

    // Get or create progress document
    let progress = await DetailedCourseProgress.findOne({ userId, courseId });
    
    if (!progress) {
      progress = new DetailedCourseProgress({
        userId,
        courseId,
        lectures: [],
        quizzes: [],
      });
    }

    // Merge local lecture progress
    if (localProgress.lectures && Array.isArray(localProgress.lectures)) {
      for (const localLecture of localProgress.lectures) {
        const existingLecture = progress.lectures.find(
          l => l.lectureId.toString() === localLecture.lectureId
        );
        
        // Only update if local progress is higher
        if (!existingLecture || localLecture.progressPercent > existingLecture.progressPercent) {
          progress.updateLectureProgress(localLecture.lectureId, {
            progressPercent: localLecture.progressPercent,
            lastTimestamp: localLecture.lastTimestamp || 0,
            duration: localLecture.duration || 0,
          });
        }
      }
    }

    // Merge local quiz progress
    if (localProgress.quizzes && Array.isArray(localProgress.quizzes)) {
      for (const localQuiz of localProgress.quizzes) {
        const existingQuiz = progress.quizzes.find(
          q => q.quizId.toString() === localQuiz.quizId
        );
        
        // Only update if local progress shows completion or better score
        if (!existingQuiz || 
            (localQuiz.completed && !existingQuiz.completed) ||
            (localQuiz.score > existingQuiz.score)) {
          progress.updateQuizProgress(localQuiz.quizId, {
            score: localQuiz.score || 0,
            passed: localQuiz.passed || false,
            completed: localQuiz.completed || false,
          });
        }
      }
    }

    // Get course data and recalculate
    const course = await Course.findById(courseId).populate("lessons quizzes");
    if (course) {
      const totalLectures = course.curriculum.length || course.lessons?.length || 0;
      const totalQuizzes = course.quizzes?.length || 0;

      const calculatedProgress = DetailedCourseProgress.calculateProgress(
        {
          lectures: progress.lectures,
          quizzes: progress.quizzes,
        },
        {
          totalLectures,
          totalQuizzes,
        }
      );

      Object.assign(progress, {
        ...calculatedProgress,
        totalLecturesCount: totalLectures,
        totalQuizzesCount: totalQuizzes,
      });
    }

    await progress.save();

    res.status(200).json({
      success: true,
      message: "Local progress merged successfully",
      data: {
        mergedProgress: {
          overallProgressPercent: progress.overallProgressPercent,
          videoProgressPercent: progress.videoProgressPercent,
          completedLecturesCount: progress.completedLecturesCount,
          totalLecturesCount: progress.totalLecturesCount,
          certificateEligible: progress.certificateEligible,
          certificateProgressPercent: progress.certificateProgressPercent,
        },
      },
    });
  } catch (error) {
    console.error("Error merging local progress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  updateLectureProgress,
  getCourseProgress,
  getCertificateProgress,
  updateQuizProgress,
  mergeLocalProgress,
};
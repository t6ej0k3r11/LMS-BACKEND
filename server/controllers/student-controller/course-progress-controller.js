const mongoose = require("mongoose");
const CourseProgress = require("../../models/CourseProgress");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");

// Helper function to check if all required quizzes (final quizzes) are completed
const checkRequiredQuizzesCompleted = async (progress, courseId) => {
  const allQuizzes = await Quiz.find({ courseId, isActive: true });
  const finalQuizzes = allQuizzes.filter((quiz) => !quiz.lectureId); // Final quizzes have no lectureId

  const allFinalQuizzesPassed = finalQuizzes.every((quiz) => {
    const quizProg = progress.quizzesProgress.find(
      (qp) => qp.quizId.toString() === quiz._id.toString()
    );
    return quizProg && quizProg.completed;
  });

  return allFinalQuizzesPassed;
};

//mark current lecture as viewed
const markCurrentLectureAsViewed = async (req, res) => {
  try {
    const { userId, courseId, lectureId } = req.body;

    let progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new CourseProgress({
        userId,
        courseId,
        lecturesProgress: [
          {
            lectureId,
            viewed: true,
            dateViewed: new Date(),
          },
        ],
      });
      await progress.save();
    } else {
      const lectureProgress = progress.lecturesProgress.find(
        (item) => item.lectureId === lectureId
      );

      if (lectureProgress) {
        lectureProgress.viewed = true;
        lectureProgress.dateViewed = new Date();
      } else {
        progress.lecturesProgress.push({
          lectureId,
          viewed: true,
          dateViewed: new Date(),
        });
      }
      await progress.save();
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    //check all the lectures are viewed and all required quizzes (final quizzes) are passed
    const allLecturesViewed =
      progress.lecturesProgress.length === course.curriculum.length &&
      progress.lecturesProgress.every((item) => item.viewed);

    // Check if all required quizzes (final quizzes) are passed
    const allRequiredQuizzesPassed = await checkRequiredQuizzesCompleted(
      progress,
      courseId
    );

    if (allLecturesViewed && allRequiredQuizzesPassed) {
      progress.completed = true;
      progress.completionDate = new Date();

      await progress.save();
    }

    res.status(200).json({
      success: true,
      message: "Lecture marked as viewed",
      data: progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

//get current course progress
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

    const currentUserCourseProgress = await CourseProgress.findOne({
      userId,
      courseId,
    });

    if (
      !currentUserCourseProgress ||
      currentUserCourseProgress?.lecturesProgress?.length === 0
    ) {
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

    res.status(200).json({
      success: true,
      data: {
        courseDetails,
        progress: currentUserCourseProgress.lecturesProgress,
        quizzesProgress: currentUserCourseProgress.quizzesProgress || [],
        completed: currentUserCourseProgress.completed,
        completionDate: currentUserCourseProgress.completionDate,
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

//update quiz progress
const updateQuizProgress = async (req, res) => {
  try {
    const { userId, courseId, quizId, score, passed } = req.body;

    let progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new CourseProgress({
        userId,
        courseId,
        lecturesProgress: [],
        quizzesProgress: [],
      });
    }

    const quizProgress = progress.quizzesProgress.find((item) =>
      item.quizId.equals(quizId)
    );

    if (quizProgress) {
      quizProgress.attempts += 1;
      quizProgress.lastAttemptDate = new Date();
      if (
        passed &&
        (!quizProgress.completed || score > quizProgress.bestScore)
      ) {
        quizProgress.completed = true;
        quizProgress.bestScore = score;
      } else if (!quizProgress.completed && score > quizProgress.bestScore) {
        quizProgress.bestScore = score;
      }
    } else {
      progress.quizzesProgress.push({
        quizId,
        completed: passed,
        bestScore: score,
        attempts: 1,
        lastAttemptDate: new Date(),
      });
    }

    await progress.save();

    // Check if course is now complete
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get all quizzes for the course
    const allQuizzes = await Quiz.find({ courseId, isActive: true });

    // Check if all lectures are viewed
    const allLecturesViewed =
      progress.lecturesProgress.length === course.curriculum.length &&
      progress.lecturesProgress.every((item) => item.viewed);

    // Check if all required quizzes (final quizzes) are passed
    const allRequiredQuizzesPassed = await checkRequiredQuizzesCompleted(
      progress,
      courseId
    );

    if (allLecturesViewed && allRequiredQuizzesPassed && !progress.completed) {
      progress.completed = true;
      progress.completionDate = new Date();
      await progress.save();
    }

    res.status(200).json({
      success: true,
      message: "Quiz progress updated",
      data: progress,
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

    const progress = await CourseProgress.findOne({ userId, courseId });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Progress not found!",
      });
    }

    progress.lecturesProgress = [];
    progress.quizzesProgress = [];
    progress.completed = false;
    progress.completionDate = null;

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

module.exports = {
  markCurrentLectureAsViewed,
  getCurrentCourseProgress,
  resetCurrentCourseProgress,
  updateQuizProgress,
};

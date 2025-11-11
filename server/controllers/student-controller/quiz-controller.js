const mongoose = require("mongoose");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const StudentCourses = require("../../models/StudentCourses");
const CourseProgress = require("../../models/CourseProgress");
const { updateQuizProgress } = require("./course-progress-controller");

const getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user?._id;

    console.log(
      "🔍 DEBUG: getQuizzesByCourse - courseId:",
      courseId,
      "studentId:",
      studentId,
      "type:",
      typeof studentId
    );

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": courseId,
    });

    console.log(
      "🔍 DEBUG: StudentCourses.findOne result:",
      studentCourses ? "found" : "null"
    );

    if (!studentCourses) {
      console.log(
        "🔍 DEBUG: Access denied - no course found for studentId:",
        studentId,
        "courseId:",
        courseId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Get course progress to check lecture completion
    const courseProgress = await require("../../models/CourseProgress").findOne(
      {
        userId: studentId,
        courseId: courseId,
      }
    );

    // Get quizzes for the course with populated attempts using aggregation to avoid N+1
    const quizzesWithAttempts = await Quiz.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId),
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "quizattempts",
          let: { quizId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$quizId", "$$quizId"] },
                    {
                      $eq: [
                        "$studentId",
                        new mongoose.Types.ObjectId(studentId),
                      ],
                    },
                  ],
                },
              },
            },
            {
              $sort: { attemptNumber: 1 },
            },
            {
              $project: {
                _id: 1,
                attemptNumber: 1,
                status: 1,
                startedAt: 1,
                completedAt: 1,
                score: 1,
                passed: 1,
              },
            },
          ],
          as: "attempts",
        },
      },
    ]);

    // Filter quizzes based on prerequisites
    const availableQuizzes = quizzesWithAttempts.filter((quiz) => {
      if (!quiz.lectureId) {
        // Final quiz - always available after enrollment
        return true;
      } else {
        // Lesson quiz - check if corresponding lecture is completed
        return (
          courseProgress && courseProgress.isLectureCompleted(quiz.lectureId)
        );
      }
    });

    res.status(200).json({
      success: true,
      data: availableQuizzes,
    });
  } catch (e) {
    console.error("Error submitting quiz attempt:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    const quiz = await Quiz.findById(quizId);

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found!",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": quiz.courseId,
    });

    console.log(
      "🔍 DEBUG: startQuizAttempt - studentCourses result:",
      studentCourses ? "found" : "null",
      "studentId:",
      studentId,
      "quiz.courseId:",
      quiz.courseId
    );

    if (!studentCourses) {
      console.log(
        "🔍 DEBUG: Access denied - no course found for studentId:",
        studentId,
        "courseId:",
        quiz.courseId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Check prerequisites for quiz access
    if (quiz.lectureId) {
      // Lesson quiz - check if corresponding lecture is completed
      const courseProgress =
        await require("../../models/CourseProgress").findOne({
          userId: studentId,
          courseId: quiz.courseId,
        });

      if (
        !courseProgress ||
        !courseProgress.isLectureCompleted(quiz.lectureId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You must complete the corresponding lecture before attempting this quiz.",
        });
      }
    }
    // Final quiz - no prerequisites required beyond course enrollment

    // Get existing attempts for this student and quiz
    const attempts = await QuizAttempt.find({
      quizId,
      studentId,
    }).sort({ attemptNumber: 1 });

    // Return quiz without correct answers
    const quizForStudent = {
      _id: quiz._id,
      courseId: quiz.courseId,
      lectureId: quiz.lectureId,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions.map((q) => ({
        _id: q._id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
      })),
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit,
      attemptsAllowed: quiz.attemptsAllowed,
    };

    res.status(200).json({
      success: true,
      data: {
        quiz: quizForStudent,
        attempts: attempts.map((attempt) => ({
          _id: attempt._id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          score: attempt.score,
          passed: attempt.passed,
        })),
      },
    });
  } catch (e) {
    console.error("Error getting quiz by ID:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const startQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    const quiz = await Quiz.findById(quizId);

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found!",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": quiz.courseId,
    });

    console.log(
      "🔍 DEBUG: getQuizById - studentCourses result:",
      studentCourses ? "found" : "null",
      "studentId:",
      studentId,
      "quiz.courseId:",
      quiz.courseId
    );

    if (!studentCourses) {
      console.log(
        "🔍 DEBUG: Access denied - no course found for studentId:",
        studentId,
        "courseId:",
        quiz.courseId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Check prerequisites for quiz access
    if (quiz.lectureId) {
      // Lesson quiz - check if corresponding lecture is completed
      const courseProgress =
        await require("../../models/CourseProgress").findOne({
          userId: studentId,
          courseId: quiz.courseId,
        });

      if (
        !courseProgress ||
        !courseProgress.isLectureCompleted(quiz.lectureId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You must complete the corresponding lecture before attempting this quiz.",
        });
      }
    }
    // Final quiz - no prerequisites required beyond course enrollment

    // Allow unlimited attempts for all quizzes - students can take quizzes as many times as they want
    // Always create a new attempt, even if there are active ones

    // Get existing attempts count
    const existingAttempts = await QuizAttempt.countDocuments({
      quizId,
      studentId,
    });

    const attemptNumber = existingAttempts + 1;
    const startedAt = new Date();

    const newAttempt = new QuizAttempt({
      quizId,
      studentId,
      courseId: quiz.courseId,
      attemptNumber,
      answers: [],
      score: 0,
      totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
      pointsEarned: 0,
      passed: false,
      startedAt,
      completedAt: startedAt, // Will be updated on submit
      timeSpent: 0,
    });

    const savedAttempt = await newAttempt.save();

    res.status(201).json({
      success: true,
      message: "Quiz attempt started",
      data: {
        attemptId: savedAttempt._id,
        attemptNumber,
        startedAt,
        timeLimit: quiz.timeLimit,
        isExistingAttempt: false,
      },
    });
  } catch (e) {
    console.error("Error getting quizzes by course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const submitQuizAttempt = async (req, res) => {
  try {
    const { quizId, attemptId } = req.params;
    const { answers } = req.body; // Array of { questionId, answer }
    const studentId = req.user._id;

    if (!quizId || !attemptId) {
      return res.status(400).json({
        success: false,
        message: "Invalid parameters",
      });
    }

    console.log(
      "🔍 DEBUG: submitQuizAttempt called with quizId:",
      quizId,
      "attemptId:",
      attemptId,
      "studentId:",
      studentId,
      "answers count:",
      answers?.length || 0
    );

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      console.log("🔍 DEBUG: Quiz not found for quizId:", quizId);
      return res.status(404).json({
        success: false,
        message: "Quiz not found!",
      });
    }

    // Check if student has purchased the course

    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": quiz.courseId,
    });

    console.log(
      "🔍 DEBUG: submitQuizAttempt - studentCourses result:",
      studentCourses ? "found" : "null",
      "studentId:",
      studentId,
      "quiz.courseId:",
      quiz.courseId
    );

    if (!studentCourses) {
      console.log(
        "🔍 DEBUG: Access denied - no course found for studentId:",
        studentId,
        "courseId:",
        quiz.courseId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId);

    console.log("🔍 DEBUG: Attempt found:", !!attempt);
    if (!attempt) {
      console.log("🔍 DEBUG: Attempt not found - attemptId:", attemptId);
      return res.status(404).json({
        success: false,
        message: "Attempt not found!",
      });
    }

    // Verify ownership
    console.log(
      "🔍 DEBUG: Verifying ownership - attempt.studentId:",
      attempt.studentId?.toString(),
      "studentId:",
      studentId,
      "attempt.quizId:",
      attempt.quizId?.toString(),
      "quizId:",
      quizId
    );
    if (
      attempt.studentId.toString() !== studentId ||
      attempt.quizId.toString() !== quizId
    ) {
      console.log("🔍 DEBUG: Ownership verification failed");
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }
    console.log("🔍 DEBUG: Ownership verified successfully");

    // Check if already completed with atomic operation to prevent race conditions
    console.log(
      "🔍 DEBUG: Checking if attempt is already completed - attemptId:",
      attemptId,
      "current status:",
      attempt.status
    );
    const updateResult = await QuizAttempt.findOneAndUpdate(
      {
        _id: attemptId,
        status: { $ne: "completed" }, // Only update if not already completed
      },
      {
        $set: {
          status: "processing", // Temporary status to lock the attempt
        },
      },
      { new: true }
    );

    console.log("🔍 DEBUG: Atomic update result:", !!updateResult);
    if (!updateResult) {
      console.log("🔍 DEBUG: Attempt already submitted or processing");
      return res.status(400).json({
        success: false,
        message: "Attempt already submitted or processing.",
      });
    }

    const completedAt = new Date();
    const timeSpent = Math.floor((completedAt - attempt.startedAt) / 1000); // in seconds

    console.log(
      "🔍 DEBUG: Time calculation - startedAt:",
      attempt.startedAt,
      "completedAt:",
      completedAt,
      "timeSpent:",
      timeSpent,
      "timeLimit:",
      quiz.timeLimit
    );

    // No time limit enforcement - students can take quizzes at their own pace

    // Calculate score
    console.log(
      "🔍 DEBUG: Starting score calculation - answers length:",
      answers?.length || 0
    );
    let pointsEarned = 0;
    const processedAnswers = answers
      .map((answer) => {
        const question = quiz.questions.id(answer.questionId);
        console.log(
          "🔍 DEBUG: Processing answer for questionId:",
          answer.questionId,
          "question found:",
          !!question
        );
        if (!question) {
          console.log("🔍 DEBUG: Question not found for answer:", answer);
          return null;
        }

        let isCorrect = null;
        let points = 0;

        if (question.type === "broad-text") {
          // Broad text questions need manual review - no points until reviewed
          isCorrect = null;
          points = 0;
        } else {
          // Automatic marking for multiple choice, true-false, etc.
          isCorrect = question.correctAnswer === answer.answer;
          points = isCorrect ? question.points || 1 : 0;
          pointsEarned += points;
          console.log(
            "🔍 DEBUG: Question marked - type:",
            question.type,
            "isCorrect:",
            isCorrect,
            "points:",
            points
          );
        }

        return {
          questionId: answer.questionId,
          answer: answer.answer,
          isCorrect,
          pointsEarned: points,
          needsReview: question.type === "broad-text",
        };
      })
      .filter(Boolean);

    console.log(
      "🔍 DEBUG: Score calculation complete - processedAnswers:",
      processedAnswers.length,
      "pointsEarned:",
      pointsEarned
    );

    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    // Calculate total points from auto-gradable questions only
    const totalAutoGradablePoints = quiz.questions
      .filter((q) => q.type !== "broad-text")
      .reduce((sum, q) => sum + q.points, 0);
    console.log(
      "🔍 DEBUG: Final calculations - totalPoints:",
      totalPoints,
      "totalAutoGradablePoints:",
      totalAutoGradablePoints,
      "pointsEarned:",
      pointsEarned
    );
    // For quizzes with broad-text questions, score is based only on auto-gradable questions
    const hasUnreviewedQuestions = processedAnswers.some(
      (answer) => answer.needsReview
    );
    const score =
      totalAutoGradablePoints > 0
        ? Math.round((pointsEarned / totalAutoGradablePoints) * 100)
        : 0;
    // For final quiz, require 80% minimum score
    const requiredScore = quiz.quizType === "final" ? 80 : quiz.passingScore;
    const passed = hasUnreviewedQuestions ? false : score >= requiredScore;

    console.log(
      "🔍 DEBUG: Final results - hasUnreviewedQuestions:",
      hasUnreviewedQuestions,
      "score:",
      score,
      "passed:",
      passed,
      "passingScore:",
      quiz.passingScore
    );

    // Update attempt atomically
    console.log("🔍 DEBUG: Updating attempt with final results");
    await QuizAttempt.findByIdAndUpdate(attemptId, {
      answers: processedAnswers,
      score,
      pointsEarned,
      passed,
      completedAt,
      timeSpent,
      status: "completed",
    });
    console.log("🔍 DEBUG: Attempt updated successfully");

    // Update quiz progress in course progress
    console.log("🔍 DEBUG: Updating quiz progress in course progress");
    try {
      await updateQuizProgress(
        {
          body: {
            userId: studentId,
            courseId: quiz.courseId.toString(),
            quizId: quizId,
            score,
            passed,
          },
        },
        {
          status: () => ({ json: () => {} }),
        }
      );
      console.log("🔍 DEBUG: Quiz progress updated successfully");
    } catch (progressError) {
      console.log("🔍 DEBUG: Error updating quiz progress:", progressError);
      // Don't fail the quiz submission if progress update fails
    }

    console.log("🔍 DEBUG: Quiz submission successful - returning response");
    res.status(200).json({
      success: true,
      message: "Quiz submitted successfully",
      data: {
        score,
        pointsEarned,
        totalPoints,
        passed,
        timeSpent,
        courseId: quiz.courseId,
      },
    });
  } catch (e) {
    console.error("🔍 DEBUG: Error in submitQuizAttempt:", e);
    console.error("🔍 DEBUG: Error stack:", e.stack);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    // Validate quizId format
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format!",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found!",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": quiz.courseId,
    });

    console.log(
      "🔍 DEBUG: getQuizResults - studentCourses result:",
      studentCourses ? "found" : "null",
      "studentId:",
      studentId,
      "quiz.courseId:",
      quiz.courseId
    );

    if (!studentCourses) {
      console.log(
        "🔍 DEBUG: Access denied - no course found for studentId:",
        studentId,
        "courseId:",
        quiz.courseId
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const attempts = await QuizAttempt.find({
      quizId,
      studentId,
    }).sort({ attemptNumber: 1 });

    // Get the latest attempt for detailed results
    const latestAttempt = attempts[attempts.length - 1];

    let answers = [];
    if (latestAttempt) {
      // Build answers array with question details
      answers = latestAttempt.answers.map((answer) => {
        const question = quiz.questions.id(answer.questionId);
        return {
          questionId: answer.questionId,
          question: question?.question || "Question not found",
          userAnswer: answer.answer,
          isCorrect: answer.isCorrect,
          correctAnswer: question?.correctAnswer || "",
          pointsEarned: answer.pointsEarned || 0,
          needsReview: answer.needsReview || false,
        };
      });
    }

    // For final quiz, show required score
    const requiredScore = quiz.quizType === "final" ? 80 : quiz.passingScore;
    const maxAttempts = quiz.quizType === "final" ? 2 : quiz.attemptsAllowed;

    res.status(200).json({
      success: true,
      data: {
        quiz: {
          _id: quiz._id,
          courseId: quiz.courseId,
          title: quiz.title,
          passingScore: requiredScore,
          attemptsAllowed: maxAttempts,
          quizType: quiz.quizType,
        },
        score: latestAttempt?.score || 0,
        passed: latestAttempt?.passed || false,
        answers: answers,
        attempts: attempts.map((attempt) => ({
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          passed: attempt.passed,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          timeSpent: attempt.timeSpent,
        })),
      },
    });
  } catch (e) {
    console.error("Error getting quiz results:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = {
  getQuizzesByCourse,
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizResults,
};

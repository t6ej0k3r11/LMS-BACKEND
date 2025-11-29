const mongoose = require("mongoose");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const QuestionBank = require("../../models/QuestionBank");
const StudentCourses = require("../../models/StudentCourses");
const CourseProgress = require("../../models/CourseProgress");
const { updateQuizProgress } = require("./course-progress-controller");

// Helper function to validate quiz questions
const validateQuizQuestions = async (quiz) => {
  const missingQuestions = [];
  for (const q of quiz.questions) {
    if (q.mode === "bank" && q.bankQuestionId) {
      const bankQuestion = await QuestionBank.findById(q.bankQuestionId);
      if (!bankQuestion) {
        missingQuestions.push(q.bankQuestionId);
      }
    }
  }
  return missingQuestions;
};

const getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    // Validate courseId format
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
    });

    let enrolled = false;

    // Check StudentCourses first
    if (studentCourses) {
      const courseIndex = studentCourses.courses.findIndex(
        (item) => item.courseId === courseId
      );
      enrolled = courseIndex > -1;
    }

    // If not enrolled according to StudentCourses, check Course.students as fallback
    // and sync if found
    if (!enrolled) {
      const course = await Course.findById(courseId);
      if (course) {
        const isEnrolledInCourse = course.students.some(
          (student) => student.studentId === studentId.toString()
        );

        if (isEnrolledInCourse) {
          // Sync: add to StudentCourses
          enrolled = true;

          if (!studentCourses) {
            const newStudentCourses = new StudentCourses({
              userId: studentId.toString(),
              courses: [{
                courseId: courseId,
                title: course.title,
                instructorId: course.instructorId,
                instructorName: course.instructorName,
                dateOfPurchase: new Date(),
                courseImage: course.image,
              }]
            });
            await newStudentCourses.save();
          } else {
            studentCourses.courses.push({
              courseId: courseId,
              title: course.title,
              instructorId: course.instructorId,
              instructorName: course.instructorName,
              dateOfPurchase: new Date(),
              courseImage: course.image,
            });
            await studentCourses.save();
          }
        }
      }
    }

    if (!enrolled) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Get course progress to check lecture completion
    const courseProgress = await CourseProgress.findOne({
      userId: studentId,
      courseId: courseId,
    });

    // Get quizzes for the course with populated attempts using aggregation to avoid N+1
    console.log("DEBUG: Running aggregation for courseId:", courseId, "studentId:", studentId);

    const quizzesWithAttempts = await Quiz.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId),
          isActive: true, // Only active quizzes
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
      {
        $project: {
          _id: 1,
          courseId: 1,
          prerequisiteLectureIds: 1,
          quizType: 1,
          title: 1,
          description: 1,
          passingScore: 1,
          timeLimit: 1,
          attemptsAllowed: 1,
          instantFeedbackEnabled: 1,
          isActive: 1,
          isValid: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          attempts: 1,
        },
      },
    ]);

    console.log("DEBUG: Aggregation completed, found", quizzesWithAttempts.length, "quizzes");

    // Filter quizzes based on prerequisites
    const availableQuizzes = quizzesWithAttempts.filter((quiz) => {
      if (
        !quiz.prerequisiteLectureIds ||
        quiz.prerequisiteLectureIds.length === 0
      ) {
        // Final quiz or no prerequisites - always available after enrollment
        return true;
      } else {
        // Check if all prerequisite lectures are completed
        return (
          courseProgress &&
          quiz.prerequisiteLectureIds.every(
            (lectureId) =>
              courseProgress.lectures.get(lectureId.toString()) === "completed"
          )
        );
      }
    });

    res.status(200).json({
      success: true,
      data: availableQuizzes,
    });
  } catch (e) {
    console.error("Error getting quizzes by course:", e);
    console.error("Error details:", e.message);
    console.error("Stack trace:", e.stack);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quizzes. Please try again.",
    });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    // Validate quizId format
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz || quiz.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found or inactive",
      });
    }

    // Validate questions
    const missingQuestions = await validateQuizQuestions(quiz);
    if (missingQuestions.length > 0) {
      // Mark quiz as invalid
      await Quiz.findByIdAndUpdate(quizId, { isValid: false });
      return res.status(400).json({
        success: false,
        message:
          "Quiz contains missing questions. Please contact the instructor to fix the quiz.",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
      "courses.courseId": quiz.courseId,
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Check prerequisites for quiz access
    if (quiz.prerequisiteLectureIds && quiz.prerequisiteLectureIds.length > 0) {
      const courseProgress = await CourseProgress.findOne({
        userId: studentId,
        courseId: quiz.courseId,
      });

      const allPrereqsCompleted = quiz.prerequisiteLectureIds.every(
        (lectureId) =>
          courseProgress &&
          courseProgress.lectures.get(lectureId.toString()) === "completed"
      );

      if (!allPrereqsCompleted) {
        return res.status(403).json({
          success: false,
          message:
            "You must complete all prerequisite lectures before attempting this quiz.",
        });
      }
    }
    // No prerequisites required beyond course enrollment

    // Get existing attempts for this student and quiz
    const attempts = await QuizAttempt.find({
      quizId,
      studentId,
    }).sort({ attemptNumber: 1 });

    // Process questions - handle both custom and bank questions
    const processedQuestions = [];
    for (const q of quiz.questions) {
      if (q.mode === "bank" && q.bankQuestionId) {
        // Fetch bank question data
        const bankQuestion = await QuestionBank.findById(q.bankQuestionId);
        if (bankQuestion) {
          processedQuestions.push({
            _id: q._id,
            mode: "bank",
            bankQuestionId: q.bankQuestionId,
            type: bankQuestion.type || "multiple-choice", // Default fallback
            question: bankQuestion.questionText,
            options: bankQuestion.options,
            points: q.points || 1,
            subject: bankQuestion.subject,
            difficulty: bankQuestion.difficulty,
            tags: bankQuestion.tags,
          });
        } else {
          // Bank question not found, skip or add placeholder
          console.warn(
            `Bank question ${q.bankQuestionId} not found for quiz ${quizId}`
          );
        }
      } else {
        // Custom question
        processedQuestions.push({
          _id: q._id,
          mode: "custom",
          type: q.type,
          question: q.question,
          options: q.options,
          points: q.points,
        });
      }
    }

    // Return quiz without correct answers
    const quizForStudent = {
      _id: quiz._id,
      courseId: quiz.courseId,
      prerequisiteLectureIds: quiz.prerequisiteLectureIds,
      title: quiz.title,
      description: quiz.description,
      questions: processedQuestions,
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
          ...(attempt.status === "in_progress" && {
            answers: attempt.answers.map((a) => ({
              questionId: a.questionId,
              answer: a.answer,
            })),
          }),
        })),
      },
    });
  } catch (e) {
    console.error("Error getting quiz by ID:", e);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz. Please try again.",
    });
  }
};

const startQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    // Validate quizId format
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz || quiz.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found or inactive",
      });
    }

    // Validate questions
    const missingQuestions = await validateQuizQuestions(quiz);
    if (missingQuestions.length > 0) {
      // Mark quiz as invalid
      await Quiz.findByIdAndUpdate(quizId, { isValid: false });
      return res.status(400).json({
        success: false,
        message:
          "Quiz contains missing questions. Please contact the instructor to fix the quiz.",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
      "courses.courseId": quiz.courseId,
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Check prerequisites for quiz access
    if (quiz.prerequisiteLectureIds && quiz.prerequisiteLectureIds.length > 0) {
      const courseProgress = await CourseProgress.findOne({
        userId: studentId,
        courseId: quiz.courseId,
      });

      const allPrereqsCompleted = quiz.prerequisiteLectureIds.every(
        (lectureId) =>
          courseProgress &&
          courseProgress.lectures.get(lectureId.toString()) === "completed"
      );

      if (!allPrereqsCompleted) {
        return res.status(403).json({
          success: false,
          message:
            "You must complete all prerequisite lectures before attempting this quiz.",
        });
      }
    }
    // No prerequisites required beyond course enrollment

    // Count only completed attempts toward the limit
    const completedAttemptsCount = await QuizAttempt.countDocuments({
      quizId,
      studentId,
      status: { $ne: "in_progress" },
    });

    if (
      quiz.attemptsAllowed &&
      completedAttemptsCount >= quiz.attemptsAllowed
    ) {
      return res.status(403).json({
        success: false,
        message: `Maximum attempts (${quiz.attemptsAllowed}) reached for this quiz.`,
      });
    }

    // Check for in-progress attempt and resume instead of blocking
    const inProgressAttempt = await QuizAttempt.findOne({
      quizId,
      studentId,
      status: "in_progress",
    });

    if (inProgressAttempt) {
      return res.status(200).json({
        success: true,
        message: "Resuming existing quiz attempt",
        data: {
          attemptId: inProgressAttempt._id,
          attemptNumber: inProgressAttempt.attemptNumber,
          startedAt: inProgressAttempt.startedAt,
          timeLimit: quiz.timeLimit,
          isExistingAttempt: true,
        },
      });
    }

    const attemptNumber = completedAttemptsCount + 1;
    const startedAt = new Date();

    const newAttempt = new QuizAttempt({
      quizId,
      studentId,
      courseId: quiz.courseId,
      attemptNumber,
      answers: [],
      score: 0,
      totalPoints: quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0),
      pointsEarned: 0,
      passed: false,
      status: "in_progress",
      startedAt,
      completedAt: startedAt, // Will be updated on submit
      timeSpent: 0,
    });

    const savedAttempt = await newAttempt.save();

    res.status(201).json({
      success: true,
      message: "Quiz attempt started successfully",
      data: {
        attemptId: savedAttempt._id,
        attemptNumber,
        startedAt,
        timeLimit: quiz.timeLimit,
        isExistingAttempt: false,
      },
    });
  } catch (e) {
    console.error("Error starting quiz attempt:", e);
    res.status(500).json({
      success: false,
      message: "Failed to start quiz attempt. Please try again.",
    });
  }
};

const submitQuizAttempt = async (req, res) => {
  try {
    const { quizId, attemptId } = req.params;
    const { answers } = req.body; // Array of { questionId, answer }
    const studentId = req.user._id;

    // Validate parameters
    if (
      !quizId ||
      !attemptId ||
      !mongoose.Types.ObjectId.isValid(quizId) ||
      !mongoose.Types.ObjectId.isValid(attemptId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz or attempt ID format",
      });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be provided as an array",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Validate questions
    const missingQuestions = await validateQuizQuestions(quiz);
    if (missingQuestions.length > 0) {
      // Mark quiz as invalid
      await Quiz.findByIdAndUpdate(quizId, { isValid: false });
      return res.status(400).json({
        success: false,
        message:
          "Quiz contains missing questions. Please contact the instructor to fix the quiz.",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const courseIndex = studentCourses.courses.findIndex(
      (item) => item.courseId === quiz.courseId
    );

    if (courseIndex === -1) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    // Verify ownership
    if (
      attempt.studentId.toString() !== studentId ||
      attempt.quizId.toString() !== quizId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid attempt ownership.",
      });
    }

    // Check if already completed with atomic operation to prevent race conditions
    const updateResult = await QuizAttempt.findOneAndUpdate(
      {
        _id: attemptId,
        status: { $ne: "completed" }, // Only update if not already completed
      },
      {
        $set: {
          status: "in_progress",
          isLocked: true, // Temporary lock to indicate processing
        },
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(400).json({
        success: false,
        message: "Quiz attempt has already been submitted.",
      });
    }

    const completedAt = new Date();
    const timeSpent = Math.floor((completedAt - attempt.startedAt) / 1000); // in seconds

    // Calculate score
    let pointsEarned = 0;
    const processedAnswers = await Promise.all(
      answers.map(async (answer) => {
        const question = quiz.questions.id(answer.questionId);
        if (!question) {
          return null;
        }

        let isCorrect = null;
        let points = 0;
        let correctAnswer = "";
        let questionType = question.type;

        if (question.mode === "bank" && question.bankQuestionId) {
          // Fetch bank question data for grading
          const bankQuestion = await QuestionBank.findById(
            question.bankQuestionId
          );
          if (bankQuestion) {
            correctAnswer = bankQuestion.correctAnswer;
            questionType = bankQuestion.type || "multiple-choice";
          } else {
            console.warn(
              `Bank question ${question.bankQuestionId} not found for grading`
            );
            return null;
          }
        } else {
          // Custom question
          correctAnswer = question.correctAnswer;
        }

        if (questionType === "broad-text") {
          // Broad text questions need manual review - no points until reviewed
          isCorrect = null;
          points = 0;
        } else {
          // Automatic marking for multiple choice, true-false, etc.
          isCorrect = correctAnswer === answer.answer;
          points = isCorrect ? question.points || 1 : 0;
          pointsEarned += points;
        }

        return {
          questionId: answer.questionId,
          answer: answer.answer,
          isCorrect,
          pointsEarned: points,
          needsReview: questionType === "broad-text",
        };
      })
    );

    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    // Calculate total points from auto-gradable questions only
    const totalAutoGradablePoints = quiz.questions
      .filter((q) => q.type !== "broad-text")
      .reduce((sum, q) => sum + q.points, 0);

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

    // Update attempt atomically
    await QuizAttempt.findByIdAndUpdate(attemptId, {
      answers: processedAnswers,
      score,
      pointsEarned,
      passed,
      completedAt,
      timeSpent,
      status: "completed",
      isLocked: false, // Unlock after processing
    });

    // Update quiz progress in course progress
    try {
      await updateQuizProgress(
        studentId,
        quiz.courseId.toString(),
        quizId,
        score,
        passed
      );
    } catch (progressError) {
      console.error("Error updating quiz progress:", progressError);
      // Don't fail the quiz submission if progress update fails
    }

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
    console.error("Error submitting quiz attempt:", e);
    res.status(500).json({
      success: false,
      message: "Failed to submit quiz. Please try again.",
    });
  }
};

const validateQuizAccess = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    // Validate quizId format
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        canStart: false,
        message: "Invalid quiz ID format",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz || quiz.isActive === false) {
      return res.status(404).json({
        success: false,
        canStart: false,
        message: "Quiz not found or inactive",
      });
    }

    // Validate questions
    const missingQuestions = await validateQuizQuestions(quiz);
    if (missingQuestions.length > 0) {
      // Mark quiz as invalid
      await Quiz.findByIdAndUpdate(quizId, { isValid: false });
      return res.status(400).json({
        success: false,
        canStart: false,
        message:
          "Quiz contains missing questions. Please contact the instructor to fix the quiz.",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
      "courses.courseId": quiz.courseId,
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        canStart: false,
        message: "Access denied. Course not purchased.",
      });
    }

    // Check prerequisites for quiz access
    if (quiz.prerequisiteLectureIds && quiz.prerequisiteLectureIds.length > 0) {
      const courseProgress = await CourseProgress.findOne({
        userId: studentId,
        courseId: quiz.courseId,
      });

      const allPrereqsCompleted = quiz.prerequisiteLectureIds.every(
        (lectureId) =>
          courseProgress &&
          courseProgress.lectures.get(lectureId.toString()) === "completed"
      );

      if (!allPrereqsCompleted) {
        return res.status(403).json({
          success: false,
          canStart: false,
          message:
            "You must complete all prerequisite lectures before attempting this quiz.",
        });
      }
    }

    // Get existing attempts for this student and quiz
    const attempts = await QuizAttempt.find({
      quizId,
      studentId,
    }).sort({ attemptNumber: 1 });

    // Check if quiz has questions
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        success: false,
        canStart: false,
        message: "This quiz has no questions. Please contact your instructor.",
      });
    }

    // Determine if we should resume an existing attempt
    let resumeAttemptId = null;
    let resumeReason = null;

    // Check for in-progress attempt
    const inProgressAttempt = attempts.find(
      (attempt) => attempt.status === "in_progress"
    );
    if (inProgressAttempt) {
      resumeAttemptId = inProgressAttempt._id;
      resumeReason = "You have an active attempt. Resuming now.";
    }

    res.status(200).json({
      success: true,
      canStart: true,
      message: resumeAttemptId
        ? resumeReason
        : "Quiz access validated successfully.",
      data: {
        quiz: {
          _id: quiz._id,
          courseId: quiz.courseId,
          prerequisiteLectureIds: quiz.prerequisiteLectureIds,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions.length, // Just count, not full data
          passingScore: quiz.passingScore,
          timeLimit: quiz.timeLimit,
          attemptsAllowed: quiz.attemptsAllowed,
          instantFeedbackEnabled: quiz.instantFeedbackEnabled,
          quizType: quiz.quizType,
        },
        attempts: attempts.map((attempt) => ({
          _id: attempt._id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          score: attempt.score,
          passed: attempt.passed,
        })),
        resumeAttemptId,
        resumeReason,
      },
    });
  } catch (e) {
    console.error("Error validating quiz access:", e);
    res.status(500).json({
      success: false,
      canStart: false,
      message: "Failed to validate quiz access. Please try again.",
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
        message: "Invalid quiz ID format",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const courseIndex = studentCourses.courses.findIndex(
      (item) => item.courseId === quiz.courseId
    );

    if (courseIndex === -1) {
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
      answers = await Promise.all(
        latestAttempt.answers.map(async (answer) => {
          const question = quiz.questions.id(answer.questionId);
          let questionText = "Question not found";
          let correctAnswer = "";

          if (question) {
            if (question.mode === "bank" && question.bankQuestionId) {
              // Fetch bank question data
              const bankQuestion = await QuestionBank.findById(
                question.bankQuestionId
              );
              if (bankQuestion) {
                questionText = bankQuestion.questionText;
                correctAnswer = bankQuestion.correctAnswer;
              }
            } else {
              // Custom question
              questionText = question.question;
              correctAnswer = question.correctAnswer || "";
            }
          }

          return {
            questionId: answer.questionId,
            question: questionText,
            userAnswer: answer.answer,
            isCorrect: answer.isCorrect,
            correctAnswer: correctAnswer,
            pointsEarned: answer.pointsEarned || 0,
            needsReview: answer.needsReview || false,
          };
        })
      );
    }

    // For final quiz, show required score
    const requiredScore = quiz.quizType === "final" ? 80 : quiz.passingScore;
    const maxAttempts = quiz.attemptsAllowed;

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
      message: "Failed to retrieve quiz results. Please try again.",
    });
  }
};

const submitQuestionAnswer = async (req, res) => {
  try {
    const { quizId, attemptId, questionId } = req.params;
    const { answer } = req.body;
    const studentId = req.user._id;

    // Validate parameters
    if (
      !quizId ||
      !attemptId ||
      !questionId ||
      !mongoose.Types.ObjectId.isValid(quizId) ||
      !mongoose.Types.ObjectId.isValid(attemptId) ||
      !mongoose.Types.ObjectId.isValid(questionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz, attempt, or question ID format",
      });
    }

    if (!answer || typeof answer !== "string") {
      return res.status(400).json({
        success: false,
        message: "Answer must be provided as a string",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check if instant feedback is enabled
    if (!quiz.instantFeedbackEnabled) {
      return res.status(400).json({
        success: false,
        message: "Instant feedback is not enabled for this quiz",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const courseIndex = studentCourses.courses.findIndex(
      (item) => item.courseId === quiz.courseId
    );

    if (courseIndex === -1) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    // Verify ownership
    if (
      attempt.studentId.toString() !== studentId ||
      attempt.quizId.toString() !== quizId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid attempt ownership.",
      });
    }

    // Check if attempt is still in progress
    if (attempt.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Quiz attempt is not in progress",
      });
    }

    // Find the question
    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Check if question is already answered
    const existingAnswerIndex = attempt.answers.findIndex(
      (ans) => ans.questionId.toString() === questionId
    );

    if (existingAnswerIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: "Question has already been answered",
      });
    }

    // Get question details for evaluation
    let correctAnswer = "";
    let questionType = question.type;
    let explanation = "";

    if (question.mode === "bank" && question.bankQuestionId) {
      // Fetch bank question data
      const bankQuestion = await QuestionBank.findById(question.bankQuestionId);
      if (bankQuestion) {
        correctAnswer = bankQuestion.correctAnswer;
        questionType = bankQuestion.type || "multiple-choice";
        explanation = bankQuestion.explanation || "";
      } else {
        return res.status(404).json({
          success: false,
          message: "Question data not found",
        });
      }
    } else {
      // Custom question
      correctAnswer = question.correctAnswer || "";
      explanation = question.explanation || "";
    }

    // Evaluate the answer
    let isCorrect = null;
    let pointsEarned = 0;

    if (questionType === "broad-text") {
      // Broad text questions need manual review
      isCorrect = null;
      pointsEarned = 0;
    } else {
      // Automatic marking for multiple choice, true-false, etc.
      isCorrect = correctAnswer === answer;
      pointsEarned = isCorrect ? question.points || 1 : 0;
    }

    // Create answer object
    const answerObj = {
      questionId,
      selectedOption: answer,
      answer,
      isCorrect,
      pointsEarned,
      needsReview: questionType === "broad-text",
      evaluatedAt: new Date(),
    };

    // Add answer to attempt
    attempt.answers.push(answerObj);

    // Update points earned
    attempt.pointsEarned += pointsEarned;

    // Calculate current score (only for auto-gradable questions)
    const autoGradableAnswers = attempt.answers.filter(
      (ans) => !ans.needsReview
    );
    const totalAutoGradablePoints = quiz.questions
      .filter((q) => q.type !== "broad-text")
      .reduce((sum, q) => sum + q.points, 0);

    if (totalAutoGradablePoints > 0) {
      attempt.score = Math.round(
        (attempt.pointsEarned / totalAutoGradablePoints) * 100
      );
    }

    await attempt.save();

    // Prepare response
    const response = {
      isCorrect,
      correctAnswer: correctAnswer,
      explanation: explanation || null,
      pointsEarned,
      currentScore: attempt.score,
      totalQuestions: quiz.questions.length,
      answeredQuestions: attempt.answers.length,
    };

    res.status(200).json({
      success: true,
      message: "Answer submitted successfully",
      data: response,
    });
  } catch (e) {
    console.error("Error submitting question answer:", e);
    res.status(500).json({
      success: false,
      message: "Failed to submit answer. Please try again.",
    });
  }
};

const finalizeQuizAttempt = async (req, res) => {
  try {
    const { quizId, attemptId } = req.params;
    const studentId = req.user._id;

    // Validate parameters
    if (
      !quizId ||
      !attemptId ||
      !mongoose.Types.ObjectId.isValid(quizId) ||
      !mongoose.Types.ObjectId.isValid(attemptId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz or attempt ID format",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check if instant feedback is enabled
    if (!quiz.instantFeedbackEnabled) {
      return res.status(400).json({
        success: false,
        message: "Instant feedback is not enabled for this quiz",
      });
    }

    // Check if student has purchased the course
    const studentCourses = await StudentCourses.findOne({
      userId: studentId.toString(),
      "courses.courseId": quiz.courseId,
    });

    if (!studentCourses) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Course not purchased.",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    // Verify ownership
    if (
      attempt.studentId.toString() !== studentId ||
      attempt.quizId.toString() !== quizId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid attempt ownership.",
      });
    }

    // Check if attempt is still in progress
    if (attempt.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Quiz attempt is not in progress",
      });
    }

    // Check if all questions are answered
    if (attempt.answers.length !== quiz.questions.length) {
      return res.status(400).json({
        success: false,
        message: "All questions must be answered before finalizing the quiz",
      });
    }

    // Finalize the attempt
    const completedAt = new Date();
    const timeSpent = Math.floor((completedAt - attempt.startedAt) / 1000);

    // Calculate final score - bank questions are already handled in the attempt.pointsEarned
    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const score = Math.round((attempt.pointsEarned / totalPoints) * 100);
    const passed = score >= quiz.passingScore;

    attempt.completedAt = completedAt;
    attempt.timeSpent = timeSpent;
    attempt.score = score;
    attempt.passed = passed;
    attempt.status = "completed";

    await attempt.save();

    // Update quiz progress in course progress
    try {
      await updateQuizProgress(
        studentId,
        quiz.courseId.toString(),
        quizId,
        score,
        passed
      );
    } catch (progressError) {
      console.error("Error updating quiz progress:", progressError);
      // Don't fail the quiz finalization if progress update fails
    }

    res.status(200).json({
      success: true,
      message: "Quiz finalized successfully",
      data: {
        score,
        pointsEarned: attempt.pointsEarned,
        totalPoints,
        passed,
        timeSpent,
        courseId: quiz.courseId,
      },
    });
  } catch (e) {
    console.error("Error finalizing quiz attempt:", e);
    res.status(500).json({
      success: false,
      message: "Failed to finalize quiz. Please try again.",
    });
  }
};

module.exports = {
  getQuizzesByCourse,
  getQuizById,
  validateQuizAccess,
  startQuizAttempt,
  submitQuizAttempt,
  submitQuestionAnswer,
  finalizeQuizAttempt,
  getQuizResults,
};

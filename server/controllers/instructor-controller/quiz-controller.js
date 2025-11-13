const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const {
  updateQuizProgress,
} = require("../student-controller/course-progress-controller");

const createQuiz = async (req, res) => {
  try {
    const {
      courseId,
      lectureId,
      quizType,
      title,
      description,
      questions,
      passingScore,
      timeLimit,
      attemptsAllowed,
    } = req.body;
    const instructorId = req.user._id; // Get user ID from JWT payload

    // Validate required fields
    if (
      !courseId ||
      !title ||
      !quizType ||
      !questions ||
      questions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: courseId, title, quizType, or questions",
      });
    }

    // Validate courseId format
    if (!courseId || !require("mongoose").Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Validate quiz type
    if (!["lesson", "final"].includes(quizType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz type. Must be 'lesson' or 'final'",
      });
    }

    // Validate lecture ID for lesson quizzes
    if (quizType === "lesson") {
      if (!lectureId) {
        return res.status(400).json({
          success: false,
          message: "Lecture ID is required for lesson quizzes",
        });
      }
      if (!require("mongoose").Types.ObjectId.isValid(lectureId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid lecture ID format",
        });
      }
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.type) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} is missing required fields`,
        });
      }

      // Validate question types
      if (
        ![
          "multiple-choice",
          "true-false",
          "broad-text",
          "short-answer",
          "essay",
        ].includes(q.type)
      ) {
        return res.status(400).json({
          success: false,
          message: `Question ${
            i + 1
          } has invalid type. Must be 'multiple-choice', 'true-false', 'broad-text', 'short-answer', or 'essay'`,
        });
      }

      // Validate options for multiple choice
      if (q.type === "multiple-choice") {
        if (!q.options || q.options.length < 2) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have at least 2 options`,
          });
        }
        if (!q.correctAnswer) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have a correct answer`,
          });
        }
      }

      // Validate correct answer for true-false
      if (
        q.type === "true-false" &&
        !["true", "false"].includes(q.correctAnswer)
      ) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} correct answer must be 'true' or 'false'`,
        });
      }

      // Validate points for all question types
      if (!q.points || q.points < 1) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have at least 1 point`,
        });
      }
    }

    const newQuiz = new Quiz({
      courseId,
      lectureId: quizType === "lesson" ? lectureId : null,
      quizType,
      title,
      description,
      questions,
      passingScore: passingScore || 70,
      timeLimit,
      attemptsAllowed: attemptsAllowed || 1,
      createdBy: instructorId,
    });

    const savedQuiz = await newQuiz.save();

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: savedQuiz,
    });
  } catch (e) {
    console.error("Error creating quiz:", e);
    res.status(500).json({
      success: false,
      message: "Failed to create quiz. Please try again.",
    });
  }
};

const getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user._id;

    // Validate courseId format
    if (!courseId || !require("mongoose").Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    const quizzes = await Quiz.find({ courseId, createdBy: instructorId });

    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (e) {
    console.error("Error getting quizzes by course:", e);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quizzes. Please try again.",
    });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user._id;

    // Validate quizId format
    if (!quizId || !require("mongoose").Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: instructorId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (e) {
    console.error("Error getting quiz by ID:", e);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz. Please try again.",
    });
  }
};

const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user._id;
    const updateData = req.body;

    // Validate quizId format
    if (!quizId || !require("mongoose").Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    const updatedQuiz = await Quiz.findOneAndUpdate(
      { _id: quizId, createdBy: instructorId },
      updateData,
      { new: true }
    );

    if (!updatedQuiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: updatedQuiz,
    });
  } catch (e) {
    console.error("Error updating quiz:", e);
    res.status(500).json({
      success: false,
      message: "Failed to update quiz. Please try again.",
    });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user._id;

    // Validate quizId format
    if (!quizId || !require("mongoose").Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    const deletedQuiz = await Quiz.findOneAndDelete({
      _id: quizId,
      createdBy: instructorId,
    });

    if (!deletedQuiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (e) {
    console.error("Error deleting quiz:", e);
    res.status(500).json({
      success: false,
      message: "Failed to delete quiz. Please try again.",
    });
  }
};

const getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user._id;

    // Validate quizId format
    if (!quizId || !require("mongoose").Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format",
      });
    }

    // First, verify the quiz belongs to the instructor
    const quiz = await Quiz.findOne({ _id: quizId, createdBy: instructorId });
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    const attempts = await QuizAttempt.find({ quizId }).populate(
      "studentId",
      "userName email"
    );

    res.status(200).json({
      success: true,
      data: attempts,
    });
  } catch (e) {
    console.error("Error getting quiz results:", e);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz results. Please try again.",
    });
  }
};

const reviewBroadTextAnswer = async (req, res) => {
  try {
    const { attemptId, questionId } = req.params;
    const { pointsEarned, reviewNotes } = req.body;
    const instructorId = req.user._id;

    // Validate parameters
    if (
      !attemptId ||
      !questionId ||
      !require("mongoose").Types.ObjectId.isValid(attemptId) ||
      !require("mongoose").Types.ObjectId.isValid(questionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt or question ID format",
      });
    }

    if (pointsEarned === undefined || pointsEarned < 0) {
      return res.status(400).json({
        success: false,
        message: "Points earned must be a non-negative number",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId).populate("quizId");
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found",
      });
    }

    // Verify the quiz belongs to the instructor
    if (attempt.quizId.createdBy.toString() !== instructorId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only review quizzes you created.",
      });
    }

    // Find and update the specific answer
    const answerIndex = attempt.answers.findIndex(
      (answer) => answer.questionId.toString() === questionId
    );

    if (answerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Answer not found for this question",
      });
    }

    const answer = attempt.answers[answerIndex];
    const question = attempt.quizId.questions.id(questionId);

    if (!question || question.type !== "broad-text") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid question type. Only broad-text questions can be reviewed.",
      });
    }

    // Update the answer with review
    answer.pointsEarned = pointsEarned;
    answer.isCorrect = pointsEarned > 0; // Consider it correct if any points awarded
    answer.needsReview = false;
    answer.reviewedBy = instructorId;
    answer.reviewDate = new Date();
    answer.reviewNotes = reviewNotes;

    // Recalculate total score
    const totalPointsEarned = attempt.answers.reduce(
      (sum, ans) => sum + (ans.pointsEarned || 0),
      0
    );
    const totalPossiblePoints = attempt.quizId.questions.reduce(
      (sum, q) => sum + q.points,
      0
    );
    const score = Math.round((totalPointsEarned / totalPossiblePoints) * 100);
    const passed = score >= attempt.quizId.passingScore;

    attempt.pointsEarned = totalPointsEarned;
    attempt.score = score;
    attempt.passed = passed;

    await attempt.save();

    // Update course progress if the quiz is now passed
    if (passed) {
      await updateQuizProgress({
        body: {
          userId: attempt.studentId,
          courseId: attempt.quizId.courseId,
          quizId: attempt.quizId._id,
          score,
          passed,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Answer reviewed successfully",
      data: {
        attempt,
        score,
        passed,
      },
    });
  } catch (e) {
    console.error("Error reviewing broad text answer:", e);
    res.status(500).json({
      success: false,
      message: "Failed to review answer. Please try again.",
    });
  }
};

const getUnreviewedAnswers = async (req, res) => {
  try {
    const instructorId = req.user._id;

    // Find all quiz attempts with unreviewed broad-text answers for quizzes created by this instructor
    const attempts = await QuizAttempt.find({
      "answers.needsReview": true,
    })
      .populate({
        path: "quizId",
        match: { createdBy: instructorId },
      })
      .populate("studentId", "userName email");

    // Filter out attempts where quizId is null (not created by this instructor)
    const filteredAttempts = attempts.filter((attempt) => attempt.quizId);

    res.status(200).json({
      success: true,
      data: filteredAttempts,
    });
  } catch (e) {
    console.error("Error getting unreviewed answers:", e);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve unreviewed answers. Please try again.",
    });
  }
};

module.exports = {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getQuizResults,
  reviewBroadTextAnswer,
  getUnreviewedAnswers,
};

const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const QuestionBank = require("../../models/QuestionBank");
const {
  updateQuizProgress,
} = require("../student-controller/course-progress-controller");

const createQuiz = async (req, res) => {
  try {
    const {
      courseId,
      prerequisiteLectureIds = [],
      quizType = "lesson",
      title,
      description,
      questions,
      passingScore,
      timeLimit,
      attemptsAllowed,
      instantFeedbackEnabled,
    } = req.body;
    const instructorId = req.user._id; // Get user ID from JWT payload

    // Validate required fields
    if (!courseId || !title || !questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: courseId, title, or questions",
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

    // Validate prerequisite lecture IDs
    if (prerequisiteLectureIds && !Array.isArray(prerequisiteLectureIds)) {
      return res.status(400).json({
        success: false,
        message: "Prerequisite lecture IDs must be an array",
      });
    }
    if (prerequisiteLectureIds) {
      for (const id of prerequisiteLectureIds) {
        if (!require("mongoose").Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid prerequisite lecture ID format",
          });
        }
      }
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      // Set default mode if not provided
      q.mode = q.mode || "custom";

      // Validate mode
      if (!["custom", "bank"].includes(q.mode)) {
        return res.status(400).json({
          success: false,
          message: `Question ${
            i + 1
          } must have a valid mode ('custom' or 'bank')`,
        });
      }

      if (q.mode === "bank") {
        // For bank questions, only bankQuestionId is required
        if (
          !q.bankQuestionId ||
          !require("mongoose").Types.ObjectId.isValid(q.bankQuestionId)
        ) {
          return res.status(400).json({
            success: false,
            message: `Question ${
              i + 1
            } (bank mode) must have a valid bankQuestionId`,
          });
        }

        // Verify the bank question exists
        const bankQuestion = await QuestionBank.findById(q.bankQuestionId);
        if (!bankQuestion) {
          return res.status(400).json({
            success: false,
            message: `Question ${
              i + 1
            } references a non-existent bank question`,
          });
        }

        // Validate points for bank questions
        if (!q.points || q.points < 1) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have at least 1 point`,
          });
        }
      } else if (q.mode === "custom") {
        // For custom questions, validate as before
        if (!q.question || !q.type) {
          return res.status(400).json({
            success: false,
            message: `Question ${
              i + 1
            } (custom mode) is missing required fields`,
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
            message: `Question ${
              i + 1
            } correct answer must be 'true' or 'false'`,
          });
        }

        // Validate points for all custom question types
        if (!q.points || q.points < 1) {
          return res.status(400).json({
            success: false,
            message: `Question ${i + 1} must have at least 1 point`,
          });
        }
      }
    }

    // Process questions to populate bank question data
    const processedQuestions = [];
    for (const q of questions) {
      if (q.mode === "bank") {
        // Fetch bank question data
        const bankQuestion = await QuestionBank.findById(q.bankQuestionId);
        processedQuestions.push({
          mode: "bank",
          bankQuestionId: q.bankQuestionId,
          type: bankQuestion.type || "multiple-choice", // fallback
          question: bankQuestion.questionText,
          options: bankQuestion.options,
          correctAnswer: bankQuestion.correctAnswer,
          points: q.points, // Use the points specified in the quiz
          requiresReview: false, // Bank questions don't require review
          explanation: bankQuestion.explanation,
          tags: bankQuestion.tags,
          subject: bankQuestion.subject,
          difficulty: bankQuestion.difficulty,
        });
      } else {
        // Custom question - keep as is
        processedQuestions.push(q);
      }
    }

    const newQuiz = new Quiz({
      courseId,
      prerequisiteLectureIds: prerequisiteLectureIds || [],
      quizType,
      title,
      description,
      questions: processedQuestions,
      passingScore: passingScore || 70,
      timeLimit,
      attemptsAllowed: attemptsAllowed || (quizType === "final" ? 2 : 1),
      instantFeedbackEnabled: instantFeedbackEnabled || false,
      isActive: true,
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
      await updateQuizProgress(
        attempt.studentId,
        attempt.quizId.courseId.toString(),
        attempt.quizId._id.toString(),
        score,
        passed
      );
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

const getQuestionsForInstructors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      difficulty,
      tags,
      search,
    } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};

    if (subject && subject !== "all") filter.subject = subject;
    if (difficulty && difficulty !== "all") filter.difficulty = difficulty;
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }
    if (search) {
      filter.$or = [
        { questionText: { $regex: search, $options: "i" } },
        { tags: { $in: [{ $regex: search, $options: "i" }] } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const questions = await QuestionBank.find(filter)
      .populate("createdBy", "userName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await QuestionBank.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQuestions: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get questions for instructors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
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
  getQuestionsForInstructors,
};

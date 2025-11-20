const express = require("express");
const {
  getQuizzesByCourse,
  getQuizById,
  validateQuizAccess,
  startQuizAttempt,
  submitQuizAttempt,
  submitQuestionAnswer,
  finalizeQuizAttempt,
  getQuizResults,
} = require("../../controllers/student-controller/quiz-controller");
const { authenticate, authorize } = require("../../middleware/auth-middleware");
const {
  validateQuizSubmission,
} = require("../../middleware/validation-middleware");

const router = express.Router();

// Apply authentication and student authorization to all routes
router.use(authenticate);
router.use(authorize("student"));

// GET /course/:courseId - get available quizzes
router.get("/course/:courseId", getQuizzesByCourse);

// GET /:quizId - get quiz for taking
router.get("/:quizId", getQuizById);

// GET /:quizId/validate - validate quiz access and prerequisites
router.get("/:quizId/validate", validateQuizAccess);

// POST /:quizId/attempt - start quiz attempt
router.post("/:quizId/attempt", startQuizAttempt);

// PUT /:quizId/attempt/:attemptId - submit quiz (legacy for non-instant feedback)
router.put(
  "/:quizId/attempt/:attemptId",
  validateQuizSubmission,
  submitQuizAttempt
);

// POST /:quizId/attempt/:attemptId/question/:questionId - submit individual question answer (instant feedback)
router.post(
  "/:quizId/attempt/:attemptId/question/:questionId",
  submitQuestionAnswer
);

// POST /:quizId/attempt/:attemptId/finalize - finalize quiz attempt (instant feedback)
router.post("/:quizId/attempt/:attemptId/finalize", finalizeQuizAttempt);

// GET /:quizId/results - get quiz results
router.get("/:quizId/results", getQuizResults);

module.exports = router;

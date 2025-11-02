const express = require("express");
const {
  getQuizzesByCourse,
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
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

// POST /:quizId/attempt - start quiz attempt
router.post("/:quizId/attempt", startQuizAttempt);

// PUT /:quizId/attempt/:attemptId - submit quiz
router.put(
  "/:quizId/attempt/:attemptId",
  validateQuizSubmission,
  submitQuizAttempt
);

// GET /:quizId/results - get quiz results
router.get("/:quizId/results", getQuizResults);

module.exports = router;

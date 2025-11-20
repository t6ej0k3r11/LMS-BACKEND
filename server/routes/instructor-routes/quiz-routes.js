const express = require("express");
const {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getQuizResults,
  reviewBroadTextAnswer,
  getUnreviewedAnswers,
  getQuestionsForInstructors,
} = require("../../controllers/instructor-controller/quiz-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");
const {
  validateQuizCreation,
} = require("../../middleware/validation-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);
// Apply instructor approval check to all routes (requires approved instructor)
router.use(checkInstructorApproved);

router.post("/create", validateQuizCreation, createQuiz);
router.get("/course/:courseId", getQuizzesByCourse);
router.get("/unreviewed-answers", getUnreviewedAnswers);
router.get("/:quizId", getQuizById);
router.put("/:quizId", validateQuizCreation, updateQuiz);
router.delete("/:quizId", deleteQuiz);
router.get("/:quizId/results", getQuizResults);
router.put("/review/:attemptId/question/:questionId", reviewBroadTextAnswer);

module.exports = router;

router.get("/unreviewed-answers", getUnreviewedAnswers);
router.get("/:quizId", getQuizById);
router.put("/:quizId", validateQuizCreation, updateQuiz);
router.delete("/:quizId", deleteQuiz);
router.get("/:quizId/results", getQuizResults);
router.put("/review/:attemptId/question/:questionId", reviewBroadTextAnswer);
router.get("/questions/for-instructors", getQuestionsForInstructors);

module.exports = router;

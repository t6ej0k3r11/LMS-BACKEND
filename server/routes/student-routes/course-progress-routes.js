const express = require("express");
const {
  getCurrentCourseProgress,
  markCurrentLectureAsViewed,
  resetCurrentCourseProgress,
  updateQuizProgress,
  updateLectureProgress,
} = require("../../controllers/student-controller/course-progress-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  validateProgressUpdate,
} = require("../../middleware/validation-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

router.get("/get/:userId/:courseId", getCurrentCourseProgress);
router.post(
  "/mark-lecture-viewed",
  validateProgressUpdate,
  markCurrentLectureAsViewed
);
router.post(
  "/update-lecture-progress",
  validateProgressUpdate,
  updateLectureProgress
);
router.post("/reset-progress", resetCurrentCourseProgress);
router.post("/update-quiz-progress", updateQuizProgress);
module.exports = router;

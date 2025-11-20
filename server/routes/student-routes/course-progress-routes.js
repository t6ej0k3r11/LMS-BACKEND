const express = require("express");
const {
  getCurrentCourseProgress,
  getUserCourseProgress,
  markCurrentLectureAsViewed,
  resetCurrentCourseProgress,
  updateLectureProgress,
} = require("../../controllers/student-controller/course-progress-controller");
const { authenticate, authorize } = require("../../middleware/auth-middleware");
const {
  validateProgressUpdate,
} = require("../../middleware/validation-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// New simplified progress endpoint
router.get("/progress/:courseId", getUserCourseProgress);

// Legacy endpoints for backward compatibility
router.get("/get/:courseId", getCurrentCourseProgress);
router.post(
  "/mark-lecture-viewed",
  validateProgressUpdate,
  markCurrentLectureAsViewed
);
router.post(
  "/reset-progress",
  authorize("student"),
  resetCurrentCourseProgress
);
router.post("/update-lecture-progress", updateLectureProgress);

module.exports = router;

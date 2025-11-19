const express = require("express");
const {
  getCurrentCourseProgress,
  getUserCourseProgress,
  markCurrentLectureAsViewed,
  resetCurrentCourseProgress,
} = require("../../controllers/student-controller/course-progress-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  validateProgressUpdate,
} = require("../../middleware/validation-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

// New simplified progress endpoint
router.get("/progress/:courseId", getUserCourseProgress);

// Legacy endpoints for backward compatibility
router.get("/get/:userId/:courseId", getCurrentCourseProgress);
router.post(
  "/mark-lecture-viewed",
  validateProgressUpdate,
  markCurrentLectureAsViewed
);
router.post("/reset-progress", resetCurrentCourseProgress);
module.exports = router;

const express = require("express");
const {
  getAnalyticsSummary,
  getCourseAnalytics,
} = require("../../controllers/instructor-controller/analytics-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  checkInstructorRole,
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

// All analytics routes require approved instructor
router.use(checkInstructorApproved);

router.get("/summary", getAnalyticsSummary);
router.get("/course/:courseId", getCourseAnalytics);

module.exports = router;

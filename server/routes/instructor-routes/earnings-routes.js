const express = require("express");
const {
  getEarningsSummary,
  getEarningsByCourse,
  getEarningsGraphData,
} = require("../../controllers/instructor-controller/earnings-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  checkInstructorRole,
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

// All earnings routes require approved instructor
router.use(checkInstructorApproved);

router.get("/summary", getEarningsSummary);
router.get("/by-course", getEarningsByCourse);
router.get("/graph-data", getEarningsGraphData);

module.exports = router;

const express = require("express");
const {
  getCoursesByStudentId,
} = require("../../controllers/student-controller/student-courses-controller");
const authenticate = require("../../middleware/auth-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

router.get("/get/:studentId", getCoursesByStudentId);

module.exports = router;

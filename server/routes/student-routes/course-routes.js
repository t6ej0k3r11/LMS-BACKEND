const express = require("express");
const {
  getStudentViewCourseDetails,
  getAllStudentViewCourses,
  checkCoursePurchaseInfo,
} = require("../../controllers/student-controller/course-controller");
const { authenticate } = require("../../middleware/auth-middleware");
const router = express.Router();

router.get("/get", getAllStudentViewCourses);
router.get("/get/details/:id", getStudentViewCourseDetails);
router.get(
  "/purchase-info/:id/:studentId",
  authenticate,
  checkCoursePurchaseInfo
);

module.exports = router;

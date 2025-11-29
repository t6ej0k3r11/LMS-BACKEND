const express = require("express");
const {
  addNewCourse,
  getAllCourses,
  getCourseDetailsByID,
  updateCourseByID,
  publishCourse,
  getEnrolledStudents,
  deleteCourseByID,
  getCoursePrerequisites,
} = require("../../controllers/instructor-controller/course-controller");
const { authenticate } = require("../../middleware/auth-middleware");
const {
  checkInstructorRole,
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");
const {
  validateCourseCreation,
} = require("../../middleware/validation-middleware");
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Course creation and management (require approved instructor)
router.post(
  "/add",
  checkInstructorApproved,
  validateCourseCreation,
  addNewCourse
);
router.post(
  "/draft",
  checkInstructorApproved,
  validateCourseCreation,
  addNewCourse
); // Alias for creating draft
router.get("/get", checkInstructorApproved, getAllCourses);
router.get("/get/students", checkInstructorApproved, getEnrolledStudents);
router.get("/get/details/:id", checkInstructorApproved, getCourseDetailsByID);
router.get(
  "/get/prerequisites/:courseId",
  checkInstructorApproved,
  getCoursePrerequisites
);
router.put(
  "/update/:id",
  checkInstructorApproved,
  validateCourseCreation,
  updateCourseByID
);
router.delete("/delete/:id", checkInstructorApproved, deleteCourseByID);

// Publishing requires approved instructor
router.patch("/:id/publish", checkInstructorApproved, publishCourse);

module.exports = router;
